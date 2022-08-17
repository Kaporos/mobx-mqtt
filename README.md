# Introduction

This library is to help you to synchronise mobx store in peer to peer using MQTT.

It will transmit all actions made to a single peer accross all conneced peers, to keep a synchronized state accross all the network

Be careful, this library is a POC but is not battle tested or anything like that, it's just a fast side project.
DO NOT USE IN SERIOUS PRODUCTION PROJECT

Another warning, by default the agent is using public mqtt broker, so your data will be visible to anyone, do not use that with sensitive data !

But, if you wanna experiment, try things, or your making a really simple project, this library is made for you !

# Usage

The usage is *really* simple.


    import {makeAutoObservable} from "mobx";
    import MobxMQTTAgent from "mobx-mqtt";
    class Counter {
        value = 0
        constructor() {
            makeAutoObservable(this)
        }
        increase(value: number) {
            this.value += value
        }
    }
    
    const counter = new Counter()
    
    const agent = new MobxMQTTAgent(counter, "SUPER_COOL_KEY")
    agent.connect()
    export default counter;

Just create a mobx store, create a new MobxMQTTAgent with it, and you're done !
The SUPER_COOL_KEY act as an identifier for your app, your browser will be synced with browsers using the same key

As a security, if the agent get disconnected from MQTT broker, all your actions will be ignored until connection is retablished.
This behavior is to avoid you to think everything works well even if it's not
