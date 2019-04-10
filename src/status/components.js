/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Track StatusPage components with associated Zendesk articles
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

const Zendesk = require("./zendesk");

class Components {
  static initClass() {
  
    this.key = "statusbot-components-map";
  }

  constructor(robot) {
    this.robot = robot;
    if (!(this instanceof Components)) { return new Components(this.robot); }
    this.robot.brain.once('loaded', () => {
      this.components = this.robot.brain.get(Components.key) || {};
      return this.robot.logger.debug(JSON.stringify(this.components));
    });
  }

  save() {
    return this.robot.brain.set(Components.key, this.components);
  }

  get(component) {
    return this.components;
  }

  degraded(component, status) {
    if (status == null) { status = "major_outage"; }
    if (component.status !== status) {
      component.status = status;
      this.save();
      return this.robot.emit("ComponentDegraded", component);
    }
  }

  operational(component) {
    if (component.status !== "operational") {
      component.status = "operational";
      this.save();
      return this.robot.emit("ComponentOperational", component);
    }
  }

  create(component) {
    if (this.components[component.id]) { return Promise.resolve(this.components[component.id]); }

    return Zendesk.createArticle(component.name)
    .then(json => {
      this.components[component.id] = {
        description: component.name,
        status: component.status,
        zendesk: { article: {id: json.article.id}
      }
      };
      this.save();

      return this.components[component.id];
  });
  }
}
Components.initClass();

module.exports = Components;
