import {action} from "mobx"
import {Client, Message} from "paho-mqtt"
import {uid} from "uid"

//This interface doesn't do anything but help to understand MobxMQTTAgent function signature
interface MobxStore {}

interface Action {
    method: string,
    state: object
    args: any[]
}

class MobxMQTTAgent {
    store: MobxStore
    key: string
    id: string
    client: Client
    registeredActions: string[] = []
    constructor(toHook: MobxStore, key?: string) {
        //The key is the MQTT topic
        //It's like the room to talk inside a house (and the house is the MQTT server)
        this.key = (key || uid())+"mobxsync"
        // Id is MQTT Client ID, must be unique
        this.id = uid()
        this.store = toHook 
		//Let's hook all functions of our store to implement custom logic
        this._hookStore()
        this.client = new Client("broker.hivemq.com", 8000, this.id)  
        this.client.onConnectionLost = this._onConnectionLost;
        this.client.onMessageArrived = this._onMessageArrived;
    }
    connect = () => {
        this.client.connect({onSuccess: this._onConnect})
    }
    private _onConnectionLost = () => {
        console.log("Connection lost !")
        this.connect() //Try to reconnect !
    }
    private _onMessageArrived = (message: Message) => {
        const action: Action = JSON.parse(message.payloadString)
        this._executeAction(action)
    }
    private _onConnect = () => {
        console.log("Connected !")
        this.client.subscribe(this.key)
        //Sending welcome message, asking others to sync with their states
        this._syncAction("welcome", [this.id])
    }


    private _syncState = (state: object) => {
        return action((u: object) => {
            Object.keys(state).map(x => {
                //@ts-ignore
                u[x] = state[x]
            })
        })
    } 

    private _executeAction = (action: Action) => {
        //If a welcome message is received, we have to send our state
        //for being synchronized with the newcomer
        if (action.method == "welcome") {
            //I don't want to send my own blank state to myself
            if (action.args[0] == this.id) {
                return
            }
            //I'm sending a dummy action accross network that does nothing but synchronizing state
            this._syncAction("sync", [])
            return
        }

        //Synchronizing state at every executed action to avoid to lose actions cause of 
        //connection lost
        this._syncState(action.state)(this.store)

        //Remember that dummy action does nothing
        if (action.method == "sync") {
            return
        }
        if (this.registeredActions.includes(action.method)) {
            //@ts-ignore
            this.store[this.getOldMethodName(action.method)](...action.args)
        } else {
			console.error("Couldn't find any method called ", action.method)
		}
    }

    private _syncAction = (method: string, args: any[]) => {
        //This weird parse(stringify) is to retrieve the current state, i didn't find a better way to do that easily
        const state = JSON.parse(JSON.stringify(this.store))
        const action: Action = {
            method,
            state,
            args
        }
        const msg = new Message(JSON.stringify(action))
        msg.destinationName = this.key
        this.client.send(msg)
    }

    //This function will hook all mobx action to stop them and send them accross the network 
    //The logic is inside _syncAction
    private _hookStore = () => {
        //@ts-ignore
        const proto = this.store.__proto__;
        const methods: string[] = Object.getOwnPropertyNames(proto)
        methods.forEach((method) => {
            if (proto[method].isMobxAction) {
                this.registeredActions.push(method)
                proto[this.getOldMethodName(method)] = proto[method]
                //@ts-ignore
                proto[method] = (...args) => {this._syncAction(method, args)}
            }
        })
    }

    //All mobx function will get replaced by new hooked ones, but old ones will be still conserved under a new name
    //returned by this function
    private getOldMethodName = (method: string) => (method+"0") 
}

export default MobxMQTTAgent;
