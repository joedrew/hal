# Description:
#   Start a release build on a particular branch in bitrise
#
#
# Author:
#   joedrew

Bot = require "../bot"
Config = require "../config"
Utils = require "../utils"

iosReleaseSlug = "5755ea6a6cd9ac0c"
iosReleaseBuildTriggerToken = Config.bitrise.token
iosReleaseWorkflow = "appstore"
bitriseURL = "https://api.bitrise.io/v0.1/apps/#{iosReleaseSlug}/builds"

class BuildBot extends Bot

  constructor: (@robot) ->
    @commands = [
      regex: /build (.*)/i
      name: "buildCommand"
    ]
    super

  buildCommand: (context) ->
    branch = context.match[1]
    buildData = JSON.stringify
      hook_info:
        type: "bitrise",
      build_params:
        branch: branch,
        workflow_id: iosReleaseWorkflow

    Utils.fetch bitriseURL,
      method: 'post',
      body: buildData,
      headers:
        "Authorization": iosReleaseBuildTriggerToken,
    .then (json) =>
      @send context,
        text: "You got it! Queued `appstore` build for branch #{branch}"
        attachments: [
          fallback: "Git branch #{branch}"
          title: "View branch #{branch}"
          title_link: "https://github.com/ecobee/ecobee-mobile-ios/tree/#{branch}"
          thumb_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
          color: "good"
          fields: [
            title: "Branch name"
            value: branch
            short: true
          ]
        ,
          fallback: "App store build for branch #{branch}"
          thumb_url: "https://www.bitrise.io/assets/placeholders/default-app-icon.png"
          title: "App Store build for #{branch}"
          title_link: json.build_url
          color: "#760FC3"
          fields: [
            title: "Build number"
            value: json.build_number
            short: true
          ]
        ]

module.exports = BuildBot
