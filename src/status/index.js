/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Manage Site Status with StatusPage and Zendesk
//
// Dependencies:
//   - underscore
//   - columnify
//
// Configuration:
//   HUBOT_STATUSBOT_CHANNEL
//   HUBOT_STATUSBOT_USERGROUP
//   HUBOT_ZENDESK_CHANNEL
//   EXPRESS_URL
//   EXPRESS_USERNAME
//   EXPRESS_PASSWORD
//
// Commands:
//   hubot status - Get a overview on StatusPage Components and Incidents
//   hubot incident list - Get an overview of incidents currently active
//   hubot incident active - Get a list of active incidents
//   hubot incident create <description> - Create a new incident. This will create a draft Zendesk article with the <description>. This command WILL NOT ACTIVATE the incident.
// Author:
//   ndaversa

const _ = require("underscore");
const columnify = require("columnify");

const Bot = require("../bot");
const Server = require("../bot/server");
const Config = require("../config");
const Components = require("../status/components");
const Incidents = require("../status/incidents");
const StatusPage = require("../status/statuspage");
const Utils = require("../utils");
const Zendesk = require("../status/zendesk");

class StatusBot extends Bot {
  static initClass() {
    this.include(Server);
  }

  constructor(robot) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.robot = robot;
    this.commands = [{
      regex: /status$/i,
      usergroup: Config.status.usergroup,
      name: "statusCommand"
    }
    , {
      regex: /incident( list)?$/i,
      usergroup: Config.status.usergroup,
      name: "listIncidentsCommand"
    }
    , {
      regex: /incident active$/i,
      usergroup: Config.status.usergroup,
      name: "listActiveIncidentsCommand"
    }
    , {
      regex: /incident create ([^]+)/i,
      usergroup: Config.status.usergroup,
      name: "createIncidentCommand"
    }
    ];

    this.endpoints = [{
      path: "/hubot/status/activate/:id",
      type: "get",
      func: this.getActivate
    }
    , {
      path: "/hubot/status/deactivate/:id",
      type: "get",
      func: this.getDeactivate
    }
    , {
      path: "/hubot/status/remove/:id",
      type: "get",
      func: this.getRemove
    }
    ];

    Zendesk.robot = this.robot;
    this.incidents = new Incidents(this.robot);
    this.components = new Components(this.robot);
    this.registerEventListeners();
    this.robot.brain.once('loaded', () => {
      setInterval(this.refreshComponents.bind(this), 60*1000); // Every 1 minute
      return this.refreshComponents();
    });
    super(...arguments);
  }

  processNextComponent(components) {
    const c = components.shift();
    if (!c) { return; }
    return this.components.create(c)
    .then(component => {
      if (c.status === "operational") {
        this.components.operational(component);
      } else {
        this.components.degraded(component, c.status);
      }
      return this.processNextComponent(components);
    });
  }

  renderComponents(components, msg) {
    const data = [];
    for (let id in components) {
      const component = components[id];
      data.push({
        article: `<${Zendesk.makeUrl(component.zendesk.article)}|:zendesk:>`,
        status: `<${Config.statuspage.homepage}|:${component.status}:>`,
        description: component.description
      });
    }
    return columnify(data, {
      truncate: true,
      columnSplitter: "     ",
      align: "left",
      showHeaders: false,
      config: { description: {maxWidth: 60}
    }
    }
    );
  }

  renderIncidents(incidents, msg) {
    const data = [];
    for (let id in incidents) {
      const incident = incidents[id];
      const status = incident.statuspage.incident.id ? "deactivate" : "activate";
      data.push({
        remove: `<${Config.server.url}/hubot/status/remove/${id}?channel=${msg.message.room}|:x:>`,
        article: `<${Zendesk.makeUrl(incident.zendesk.article)}|:zendesk:>`,
        toggle: `<${Config.server.url}/hubot/status/${status}/${id}?channel=${msg.message.room}|:${status}:>`,
        description: incident.description
      });
    }
    return columnify(data, {
      truncate: true,
      columnSplitter: "     ",
      align: "left",
      showHeaders: false,
      config: { description: {maxWidth: 60}
    }
    }
    );
  }

  listIncidents(msg, onlyActive) {
    if (onlyActive == null) { onlyActive = false; }
    const incidents = {};
    const object = this.incidents.get();
    for (let id in object) {
      const incident = object[id];
      if (onlyActive && incident.statuspage.incident.id) {
        incidents[id] = incident;
      } else if (!onlyActive) {
        incidents[id] = incident;
      }
    }
    return _.defer(() => {
      return this.send(msg, `\
\`\`\`Incidents\`\`\`
${this.renderIncidents(incidents, msg)}${_(incidents).isEmpty() ? `There are no${onlyActive ? " active" : ""} incidents` : ""}\
`
      );
    });
  }

  listComponents(msg) {
    const components = this.components.get();
    return _.defer(() => {
      return this.send(msg, `\
\`\`\`Components\`\`\`
${this.renderComponents(components, msg)}${_(components).isEmpty() ? "There are no components" : ""}\
`
      );
    });
  }

  activate(incident, msg) {
    this.robot.logger.info("Activating incident", incident);
    return StatusPage.createIncident({
      name: incident.description,
      status: "investigating"}).then(json => {
      this.send(msg, `StatusPage <${json.shortlink}|incident> *created*`);
      this.incidents.activate(incident, json.id);
      return Zendesk.activateArticle(incident.zendesk.article);
    }).then(json => {
      this.send(msg, `Zendesk <${Zendesk.makeUrl(incident.zendesk.article)}|article> *added* to known issues list`);
      return this.listIncidents(msg);
    }).catch(error => {
      return this.send(msg, `Something went wrong: ${error}`);
    });
  }

  deactivate(incident, msg) {
    this.robot.logger.info("Deactivating incident", incident);
    return StatusPage.resolveIncident(incident)
    .then(json => {
      this.send(msg, `StatusPage <${json.shortlink}|incident> resolved`);
      this.incidents.deactivate(incident, json.id);
      return Zendesk.deactivateArticle(incident.zendesk.article);
  }).then(json => {
      this.send(msg, `Zendesk <${Zendesk.makeUrl(incident.zendesk.article)}|article> *removed* from known issues list`);
      return this.listIncidents(msg);
    }).catch(error => {
      return this.send(msg, `Something went wrong: ${error}`);
    });
  }

  remove(incident, msg) {
    this.robot.logger.info("Removing incident", incident);
    return Zendesk.removeArticle(incident.zendesk.article)
    .then(() => {
      this.send(msg, `Zendesk <${Zendesk.makeUrl(incident.zendesk.article)}|article> *removed*`);
      if (incident.statuspage.incident.id) {
        return StatusPage.resolveIncident(incident)
        .then(() => {
          return this.send(msg, `StatusPage <${json.shortlink}|incident> resolved`);
        });
      }
  }).then(() => {
      this.incidents.remove(incident);
      this.send(msg, `Incident \`${incident.description}\` *removed*`);
      return this.listIncidents(msg);
      }).catch(error => {
      return this.send(msg, `Something went wrong: ${error}`);
    });
  }

  refreshComponents() {
    return StatusPage.fetchComponents()
    .then(components => {
      return this.processNextComponent(components);
  }).catch(error => {
      return this.robot.logger.error(error);
    });
  }

  getActivate(req, res) {
    const incident = this.incidents.get(req.params.id);
    const { channel } = req.query;
    if (incident && channel) {
      const msg =  {message: {room: channel}};
      this.activate(incident, msg);
      const message = `Activating \`${incident.description}\``;
      this.send(msg, message);
      return Promise.resolve(message);
    } else {
      return Promise.reject("Invalid channel or incident");
    }
  }

  getDeactivate(req, res) {
    const incident = this.incidents.get(req.params.id);
    const { channel } = req.query;
    if (incident && channel) {
      const msg =  {message: {room: channel}};
      this.deactivate(incident, msg);
      const message = `Deactivating \`${incident.description}\``;
      this.send(msg, message);
      return Promise.resolve(message);
    } else {
      return Promise.reject("Invalid channel or incident");
    }
  }

  getRemove(req, res) {
    const incident = this.incidents.get(req.params.id);
    const { channel } = req.query;
    if (incident && channel) {
      const msg =  {message: {room: channel}};
      this.remove(incident, msg);
      const message = `Removing \`${incident.description}\``;
      this.send(msg, message);
      return Promise.resolve(message);
    } else {
      return Promise.reject("Invalid channel or incident");
    }
  }

  registerEventListeners() {
    this.robot.on("ComponentDegraded", component => {
      return Zendesk.activateArticle(component.zendesk.article)
      .then(() => {
        return this.send([Config.status.channel, Config.zendesk.channel], `\
\`${component.description}\` is :major_outage:
:zendesk: <${Zendesk.makeUrl(component.zendesk.article)}|article> *added* to known issues list\
`
        );
      });
    });

    this.robot.on("ComponentOperational", component => {
      return Zendesk.deactivateArticle(component.zendesk.article)
      .then(() => {
        return this.send([Config.status.channel, Config.zendesk.channel], `\
\`${component.description}\` is now :operational:
:zendesk: <${Zendesk.makeUrl(component.zendesk.article)}|article> *removed* from known issues list\
`
        );
      });
    });

    this.robot.on("ZendeskArticleCreated", json => {
      return this.send(Config.zendesk.channel, `\
A new :zendesk: article <${Zendesk.makeUrl(json.article)}|${json.article.title}> has been *created* in response to a new incident\
`
      );
    });

    return this.robot.on("ZendeskArticleDeleted", json => {
      return this.send(Config.zendesk.channel, `\
:zendesk: article <${Zendesk.makeUrl(json.article)}|${json.article.title}> has been *deleted* since the corresponding incident was removed\
`
      );
    });
  }

  statusCommand(context) {
    context.finish();
    return this.refreshComponents()
    .then(() => {
      this.listComponents(context);
      this.listIncidents(context);
      return this.send(context, `You can activate an known incident type from above or create a new incident with: \`${this.robot.name} incident create description goes here\``);
    });
  }

  listIncidentsCommand(context) {
    context.finish();
    this.listIncidents(context);
    return this.send(context, `You can activate an known incident type from above or create a new incident with: \`${this.robot.name} incident create description goes here\``);
  }

  listActiveIncidentsCommand(context) {
    context.finish();
    this.listIncidents(context, true);
    return this.send(context, `To create a new incident: \`${this.robot.name} incident create description goes here\``);
  }

  createIncidentCommand(context) {
    const [ __, description ] = Array.from(context.match);
    return this.incidents.create({description})
    .then(incident => {
      this.send(context, `:zendesk: <${Zendesk.makeUrl(incident.zendesk.article)}|article> *created*`);
      return this.listIncidents(context);
    });
  }
}
StatusBot.initClass();

module.exports = StatusBot;
