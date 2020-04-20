const get = require('lodash.get')
const set = require('lodash.set')
const { log } = require('./helpers')

const store = {
  user: {},
  users: []
}

module.exports = {
  get: (field) => get(store, field),
  set: (field, value) => set(store, field, value),
  addUser: (newValue) => {
    const oldValues = get(store, 'users')
    set(store, 'users', oldValues.concat(newValue))
  },
  updateUser: (newUser) => {
    const oldValues = get(store, 'users')
    const ourPublicIP = get(store, 'user.publicIP')
    const theirPublicIP = get(newUser, 'data.publicIP')
    const isLocalPeer = ourPublicIP === theirPublicIP

    const updatedValues = oldValues.map((user) => {
      const storedAddress = `${user.host}:${user.port}`
      const newAddress = `${isLocalPeer ? newUser.data.host : theirPublicIP}:${newUser.data.port}`
      // update just once
      if (storedAddress === newAddress && !user.nickname) {
        user.nickname = newUser.nickname
        log(`📡 ${newUser.nickname} is connected @${newAddress} ${isLocalPeer ? 'LAN' : 'WAN'}`)
      }
      return user
    })
    set(store, 'users', updatedValues)
  },
  removeUser: (peer) => {
    const oldValues = get(store, 'users')
    const isLocalPeer = peer.local
    const filteredUsers = oldValues.filter(user => {
      const storedAddress = user.host + ':' + user.port
      const disconnectedAddress = peer.host + ':' + peer.port
      const userDisconnected = storedAddress === disconnectedAddress
      userDisconnected && log(`📡 ${user.nickname} disconnected from ${storedAddress} ${isLocalPeer ? 'LAN' : 'WAN'}`)
      return !userDisconnected
    })
    set(store, 'users', filteredUsers)
  }
}
