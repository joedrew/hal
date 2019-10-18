// Description:
//   Start a release build on a particular branch in bitrise
//
//
// Author:
//   joedrew

const Bot = require("../bot");
const Utils = require("../utils");

const iosReleaseSlug = "5755ea6a6cd9ac0c";
const iosReleaseBuildTriggerToken = "Cbbb5M7HUW5CTmdhLG6lbg";
const iosReleaseWorkflow = "appstore";
const bitriseURL = `https://app.bitrise.io/app/${iosReleaseSlug}/build/start.json`;

class BuildBot extends Bot {

  constructor() {
    var commands = [ {
      regex: /build (.*)/i,
      name: "buildCommand"
    } ];
    super(...arguments, commands);
  }

  buildCommand(context) {
    const branch = context.match[1];
    const buildData = JSON.stringify({
      "hook_info": {
        "type": "bitrise",
        "build_trigger_token": iosReleaseBuildTriggerToken
      },
      "build_params": {
        "branch": branch,
        "workflow_id": iosReleaseWorkflow
      }
    });

    Utils.fetch(bitriseURL, {
      method: 'post',
      body: buildData
    }).then( (json) => {
      this.send(context, {
        text: `You got it! Queued \`appstore\` build for branch \`${branch}\``,
        attachments: [ {
          fallback: `Git branch ${branch}`,
          title: `View branch ${branch}`,
          title_link: `https://github.com/ecobee/ecobee-mobile-ios/tree/${branch}`,
          thumb_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
          color: "good",
          fields: [
            {
              title: "Branch name",
              value: branch,
              short: true
            }
          ]
        },
        {
          fallback: `App store build for branch ${branch}`,
          thumb_url: "https://pbs.twimg.com/profile_images/1039432724120051712/wFlFGsF3_400x400.jpg",
          title: `App Store build for ${branch}`,
          title_link: json.build_url,
          color: "#760FC3",
          fields: [
            {
              title: "Build number",
              value: json.build_number,
              short: true
            }
          ]
        } ]
      });
    } );
  }
}

module.exports = BuildBot;
