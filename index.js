"use strict";
exports.__esModule = true;
var mobx_1 = require("mobx");
var paho_mqtt_1 = require("paho-mqtt");
var uid_1 = require("uid");
var MobxMQTTAgent = /** @class */ (function () {
    function MobxMQTTAgent(toHook, key) {
        var _this = this;
        this.registeredActions = [];
        this.connect = function () {
            _this.client.connect({ onSuccess: _this._onConnect });
        };
        this._onConnectionLost = function () {
            console.log("Connection lost !");
            _this.connect(); //Try to reconnect !
        };
        this._onMessageArrived = function (message) {
            var action = JSON.parse(message.payloadString);
            _this._executeAction(action);
        };
        this._onConnect = function () {
            console.log("Connected !");
            _this.client.subscribe(_this.key);
            //Sending welcome message, asking others to sync with their states
            _this._syncAction("welcome", [_this.id]);
        };
        this._syncState = function (state) {
            return mobx_1.action(function (u) {
                Object.keys(state).map(function (x) {
                    //@ts-ignore
                    u[x] = state[x];
                });
            });
        };
        this._executeAction = function (action) {
            var _a;
            //If a welcome message is received, we have to send our state
            //for being synchronized with the newcomer
            if (action.method == "welcome") {
                //I don't want to send my own blank state to myself
                if (action.args[0] == _this.id) {
                    return;
                }
                //I'm sending a dummy action accross network that does nothing but synchronizing state
                _this._syncAction("sync", []);
                return;
            }
            //Synchronizing state at every executed action to avoid to lose actions cause of 
            //connection lost
            _this._syncState(action.state)(_this.store);
            //Remember that dummy action does nothing
            if (action.method == "sync") {
                return;
            }
            if (_this.registeredActions.includes(action.method)) {
                //@ts-ignore
                (_a = _this.store)[_this.getOldMethodName(action.method)].apply(_a, action.args);
            }
            else {
                console.error("Couldn't find any method called ", action.method);
            }
        };
        this._syncAction = function (method, args) {
            //This weird parse(stringify) is to retrieve the current state, i didn't find a better way to do that easily
            var state = JSON.parse(JSON.stringify(_this.store));
            var action = {
                method: method,
                state: state,
                args: args
            };
            var msg = new paho_mqtt_1.Message(JSON.stringify(action));
            msg.destinationName = _this.key;
            _this.client.send(msg);
        };
        //This function will hook all mobx action to stop them and send them accross the network 
        //The logic is inside _syncAction
        this._hookStore = function () {
            //@ts-ignore
            var proto = _this.store.__proto__;
            var methods = Object.getOwnPropertyNames(proto);
            methods.forEach(function (method) {
                if (proto[method].isMobxAction) {
                    _this.registeredActions.push(method);
                    proto[_this.getOldMethodName(method)] = proto[method];
                    //@ts-ignore
                    proto[method] = function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        _this._syncAction(method, args);
                    };
                }
            });
        };
        //All mobx function will get replaced by new hooked ones, but old ones will be still conserved under a new name
        //returned by this function
        this.getOldMethodName = function (method) { return (method + "0"); };
        //The key is the MQTT topic
        //It's like the room to talk inside a house (and the house is the MQTT server)
        this.key = (key || uid_1.uid()) + "mobxsync";
        // Id is MQTT Client ID, must be unique
        this.id = uid_1.uid();
        this.store = toHook;
        //Let's hook all functions of our store to implement custom logic
        this._hookStore();
        this.client = new paho_mqtt_1.Client("broker.hivemq.com", 8000, this.id);
        this.client.onConnectionLost = this._onConnectionLost;
        this.client.onMessageArrived = this._onMessageArrived;
    }
    return MobxMQTTAgent;
}());
exports["default"] = MobxMQTTAgent;
