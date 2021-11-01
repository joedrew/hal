# Description:
#   Cuts a new release in Bitrise
#
#
# Author:
#   vince.p

Bot = require "../bot"
Config = require "../config"
Utils = require "../utils"

branch="develop"
iosBranchSlug = "5755ea6a6cd9ac0c"
iosBranchBuildTriggerToken = Config.bitrise.token
iosBranchWorkflow = "branch_release"
bitriseURL = "https://api.bitrise.io/v0.1/apps/#{iosBranchSlug}/builds"

class BranchBot extends Bot

  constructor: (@robot) ->
    @commands = [
      regex: /branch for release$/i
      name: "branchCommand"
    ]
    super

  branchCommand: (context) ->
    buildData = JSON.stringify
      hook_info:
        type: "bitrise",
      build_params:
        branch: branch,
        workflow_id: iosBranchWorkflow

    Utils.fetch bitriseURL,
      method: 'post',
      body: buildData,
      headers:
        "Authorization": iosBranchBuildTriggerToken,
    .then (json) =>
      @send context,
        text: "You got it! Queued `#{iosBranchWorkflow}` build for branch #{branch}"
        attachments: [
          fallback: "Branching build on #{branch}"
          thumb_url: "https://www.bitrise.io/assets/placeholders/default-app-icon.png"
          title: "Branching build on #{branch}"
          title_link: json.build_url
          color: "#760FC3"
          fields: [
            title: "Build number"
            value: json.build_number
            short: true
          ]
        ]

module.exports = BranchBot
