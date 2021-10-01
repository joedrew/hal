# Description:
#   Cuts a new release in Bitrise
#
#
# Author:
#   vince.p

Bot = require "../bot"
Utils = require "../utils"

branch="develop"
iosBranchSlug = "5755ea6a6cd9ac0c"
iosBranchBuildTriggerToken = "Cbbb5M7HUW5CTmdhLG6lbg"
iosBranchWorkflow = "branch_release"
bitriseURL = "https://app.bitrise.io/app/#{iosBranchSlug}/build/start.json"

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
        build_trigger_token: iosBranchBuildTriggerToken
      build_params:
        branch: branch,
        workflow_id: iosBranchWorkflow

    Utils.fetch bitriseURL,
      method: 'post',
      body: buildData
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
