/*
modularThingClient.js

modular-things client 

Jake Read, Leo McElroy and Quentin Bolsee at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2022

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) and modular-things projects.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

// core elements 
import OSAP from "../osapjs/core/osap.js";
import PK from "../osapjs/core/packets.js";
import TIME from "../osapjs/core/time.js";

import { addThing } from "./actions/addThing.js";
import { addRename } from "./actions/addRename.js";
import { global_state } from "./global_state.js";

import rgbbThing from "../virtualThings/rgbbThing.js";

console.log(`------------------------------------------`)
console.log("hello modular-things")

// -------------------------------------------------------- OSAP Object
let osap = new OSAP("modular-things")

// -------------------------------------------------------- SETUP NETWORK / PORT 
let wscVPort = osap.vPort("wscVPort")

// -------------------------------------------------------- Like, Application Code ? 

// and endpoint that tells us to rescan;
let rescanEndpoint = osap.endpoint("browserRescan")
rescanEndpoint.onData = () => {
  console.log('triggered a rescan...')
  rescan()
}

// a list of constructors, 
let constructors = { rgbbThing }

// a list of virtual machines, 
let scanning = false;
export const rescan = async () => {
  if (scanning) return;
  scanning = true;

  global_state.things = {};
  let usedPorts = [];

  try {
    let graph = await osap.nr.sweep()
    let usbBridge = await osap.nr.find("rt_local-usb-bridge", graph)

    for (let ch of usbBridge.children) {
      // ignore pipe up to us, 
      if (ch.name.includes("wss")) continue
      // peep across usb ports, 
      if (ch.reciprocal) {
        if (ch.reciprocal.type == "unreachable") {
          console.warn(`${ch.name}'s partner is unreachable...`)
          continue
        }
        // scrape the "rt_" osap-ness from the name of the thing, 
        let firmwareName = ch.reciprocal.parent.name.slice(3)
        console.log(`found a... "${firmwareName}" module via usb "${ch.name}"`)
        // do we already have this one in our list ?
        if (usedPorts.includes(ch.name)) {
          console.warn(`this "${firmwareName}" is already setup...`)
          continue
        } 

        // TODO: unique-name write to flashmem 
        // jake things unique-names should be more human-typeable, 
        // we also aught to check if the name is unique already, then not-change-it if it is, 
        let thingName = `${firmwareName}_${makeID(5)}`;

        // if not, check if we have a matching code for it... 
        if (constructors[firmwareName]) {
          // we need ~ to guarantee unique names also (!) 
          // create it & add to this global list
          usedPorts.push(ch.name);
          let thing = {
            vPortName: ch.name,
            firmwareName: firmwareName,
            vThing: constructors[firmwareName](osap, ch.reciprocal.parent, thingName)
          }
          // add the renaming handle... 
          await addRename(thing.vThing, osap)
          // add to our global ist, then we're done ! 
          await addThing(thingName, thing);
          // test the rename fn, 
          thing.vThing.rename("anotherNewName")
          console.error('notes below this call to console.error!')
          /*
          alright, this backend / embedded all works, but now when we rename we have 
          trouble finding the appropriate constructor, so properly things should have 
          a name... and a firmware name. i.e. a "type" and a "name" or something, you know ?
          */
        } else {
          // here is where we could roll up an "auto-object" type, if we can't find one:
          console.error(`no constructor found for the ${firmwareName} thing...`)
        }
      }
    }
  } catch (err) {
    console.error(err)
  }

  scanning = false;
}

// setTimeout(rescan, 1000)

/*
things.rgbbThing_0.handlers.onButtonStateChange = (state) => {
  if(state){
    things.rgbbThing_1.methods.setRGB(0.5, 0.5, 0.1)
  } else {
    things.rgbbThing_1.methods.setRGB(0,0,0)
  }
}
*/

// -------------------------------------------------------- Initializing the WSC Port 

// verbosity 
let LOGPHY = false
// to test these systems, the client (us) will kickstart a new process
// on the server, and try to establish connection to it.
console.log("making client-to-server request to start remote process,")
console.log("and connecting to it w/ new websocket")

let wscVPortStatus = "opening"
// here we attach the "clear to send" function,
// in this case we aren't going to flowcontrol anything, js buffers are infinite
// and also impossible to inspect  
wscVPort.cts = () => { return (wscVPortStatus == "open") }
// we also have isOpen, similarely simple here, 
wscVPort.isOpen = () => { return (wscVPortStatus == "open") }

// ok, let's ask to kick a process on the server,
// in response, we'll get it's IP and Port,
// then we can start a websocket client to connect there,
// automated remote-proc. w/ vPort & wss medium,
// for args, do '/processName.js?args=arg1,arg2'
fetch('/startLocal/osapSerialBridge.js').then(async (res) => {
  res = await res.text();
  if (res.includes('OSAP-wss-addr:')) {
    let addr = res.substring(res.indexOf(':') + 2)
    if (addr.includes('ws://')) {
      wscVPortStatus = "opening"
      // start up, 
      console.log('starting socket to remote at', addr)
      let ws = new WebSocket(addr)
      ws.binaryType = "arraybuffer"
      // opens, 
      ws.onopen = (evt) => {
        wscVPortStatus = "open"
        // implement rx
        ws.onmessage = (msg) => {
          let uint = new Uint8Array(msg.data)
          wscVPort.receive(uint)
        }
        // implement tx 
        wscVPort.send = (buffer) => {
          if (LOGPHY) console.log('PHY WSC Send', buffer)
          ws.send(buffer)
        }
      }
      ws.onerror = (err) => {
        wscVPortStatus = "closed"
        console.log('sckt err', err)
      }
      ws.onclose = (evt) => {
        wscVPortStatus = "closed"
        console.log('sckt closed', evt)
      }
    }
  } else {
    console.error('remote OSAP not established', res)
  }
})


function makeID(length) {
    var result           = '';
    var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
