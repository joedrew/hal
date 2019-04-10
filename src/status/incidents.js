/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Track incidents with associated Zendesk articles
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

class Incidents {
  static initClass() {
  
    this.key = "statusbot-incidents-map";
  }

  constructor(robot) {
    this.robot = robot;
    if (!(this instanceof Incidents)) { return new Incidents(this.robot); }
    this.robot.brain.once('loaded', () => {
      return this.incidents = this.robot.brain.get(Incidents.key) || {};
  });
  }

  save() {
    return this.robot.brain.set(Incidents.key, this.incidents);
  }

  get(key) {
    if (!key) { return this.incidents; }
    return this.incidents[key];
  }

  activate(incident, id) {
    incident.statuspage.incident.id = id;
    return this.save();
  }

  deactivate(incident) {
    incident.statuspage.incident.id = null;
    return this.save();
  }

  remove(incident) {
    delete this.incidents[incident.zendesk.article.id];
    return this.save();
  }

  create(incident) {
    if (incident.articleId) { Promise.resolve(this.incidents[incident.articleId]); }
    return Zendesk.createArticle(incident.description)
    .then(json => {
      this.incidents[json.article.id] = {
        description: incident.description,
        statuspage: { incident: {id: null}
      },
        zendesk: { article: {id: json.article.id}
      }
      };
      this.save();

      return this.incidents[json.article.id];
  });
  }
}
Incidents.initClass();

module.exports = Incidents;
