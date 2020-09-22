# Description:
#   Rebuilds www.ecobee.com with fresh data from Shopify and Contentful
#
#
# Author:
#   nonAlgebraic

Bot = require "../bot"
Utils = require "../utils"

netlifyURL = "https://api.netlify.com/build_hooks/5f69039cb0e55a20d8901e4d"

subcommands = {
  refresh: {
    description: "Rebuilds www.ecobee.com with fresh content."
    func: (context, callback) ->
      Utils.fetch netlifyURL,
        method: 'post',
      .then (json) =>
        callback "www.ecobee.com is refreshing!"
      .catch (e) =>
        callback "couldn't refresh for some reason. here's what the error was: ```#{e}```"
  }
  "compliment the team": {
    description: "Just tells the truth, honestly."
    func: (context, callback) ->
      compliments = [
        "😍 Y'all are just TOO GOOD TO BE TRUE!"
        "LITERALLY the best squad in ecobee 💯"
        "i love you OK BYEEEEEEEEEEEEEEEEEEEEEE"
      ]

      callback compliments[Math.floor(Math.random() * compliments.length)]
  }
  "remove ie support": {
    description: "Attempts to officially remove IE from our list of supported browsers. Use at own risk."
    func: (context, callback) ->
      callback "`This is Agent Smith from Microsoft's corporate engagement team. Your message has been flagged and sent to our attack robots.`"
  }
  "migrate wp": {
    description: "Automatically migrates all WordPress pages and apps to the Gatsby site"
    func: (context, callback) ->
      callback "Migration in progress! estimated time to complete: `NaN`"
  }
}

class DotComBot extends Bot

  constructor: (@robot) ->
    @commands = [
      regex: /(dotcom$|dotcom (.*))/i
      name: "dotcomCommand"
    ]
    super

  dotcomCommand: (context) ->
    subcommandKeys = Object.keys(subcommands)
    
    if !context.match[2]    
      randomSubcommandKey = subcommandKeys[Math.floor(Math.random() * subcommandKeys.length)]
      @send context,
        text: "you gotta tell me what to do! For example: `@hal dotcom #{randomSubcommandKey}` (#{subcommands[randomSubcommandKey].description})"
    else
      subcommand = context.match[2]
      if subcommandKeys.indexOf(subcommand) == -1
        @send context,
          text: "I don't recognize the subcommand \"`#{subcommand}`\" yet!"
      else
        subcommands[subcommand].func context,
          (message) =>
            @send context,
              text: message

module.exports = DotComBot
