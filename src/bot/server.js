/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const auth = require("basic-auth");
const Utils = require("../utils");

module.exports = {
  initialize() {
    if (this.endpoints) {
      return (() => {
        const result = [];
        for (let endpoint of Array.from(this.endpoints)) {
          if (endpoint.type === "get") {
            result.push(this.get(endpoint.path, endpoint.func.bind(this)));
          } else if (endpoint.type === "post") {
            result.push(this.post(endpoint.path, endpoint.func.bind(this)));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    }
  },

  get(path, cb) {
    return this.robot.router.get(path, (req, res) => {
      Utils.Stats.increment(`server.get.${path}`);
      if (this.isAuthorized(req, res)) { return cb(req, res); }
    });
  },

  post(path, cb) {
    return this.robot.router.post(path, (req, res) => {
      Utils.Stats.increment(`server.post.${path}`);
      if (this.isAuthorized(req, res)) { return cb(req, res); }
    });
  },

  isAuthorized(req, res) {
    const user = auth(req);
    if (!user || (user.name !== credentials.name) || (user.pass !== credentials.pass)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Hubot"');
      res.status(403).send("Not authorized");
      return false;
    }
    return true;
  }
};
