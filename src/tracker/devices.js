/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Track Devices
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   None
//
// Author:
//   ndaversa

class Devices {
  static initClass() {
  
    this.key = "trackerbot-device-map";
  }

  constructor(robot) {
    this.robot = robot;
    if (!(this instanceof Devices)) { return new Devices(this.robot); }
    this.robot.brain.once('loaded', () => {
      return this.devices = this.robot.brain.get(Devices.key) || {};
  });
  }

  save() {
    return this.robot.brain.set(Devices.key, this.devices);
  }

  all() { return this.devices; }

  get(key) {
    if (!key) { return this.devices; }
    return this.devices[key];
  }

  remove(device) {
    delete this.devices[device.id];
    return this.save();
  }

  add(device) {
    this.devices[device.id] = device;
    this.save();
    return this.devices[device.id];
  }
}
Devices.initClass();

module.exports = Devices;
