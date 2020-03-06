# Description:
#  Test the fuzzy matching function quickly
#
# Dependencies:
#   None
#
# Configuration:
#   None
#
# Commands:
#   fuzzy <name> - to test the fuzzy matching function
#
# Author:
#   ndaversa

Bot = require "../bot"
Utils = require "../utils"
_ = require "underscore"

class FuzzyBot extends Bot

  fuzziesKey: "fuzzy-match-attachments"

  constructor: (@robot) ->
    @robot.brain.once "loaded", =>
      @fuzzies = @robot.brain.get(@fuzziesKey) or []
      @robot.logger.debug("Fuzzies:", @fuzzies)

    @commands = [
      regex: /fuzzy (.*)/i
      name: "fuzzyCommand"
    ,
      regex: /(.+)/i
      hear: true
      name: "fuzzyMatch"
    ,
      regex: /add fuzzymatch attachment (.*)/i
      name: "addFuzzyMatch"
    ,
      regex: /remove fuzzymatch attachment (.*)/i
      name: "removeFuzzyMatch"
    ,
      regex: /list fuzzymatch attachments/i
      name: "showFuzzyMatch"
    ]
    super

  fuzzies: []

  fuzzyCommand: (context) ->
    [ __, name ] = context.match
    @send context, """
      Match for `#{name}`
      ```#{JSON.stringify Utils.fuzzyFindChatUser name}```
    """

  save: ->
    @robot.brain.set(@fuzziesKey, @fuzzies)

  addFuzzyMatch: (context) ->
    [ __, property ] = context.match
    room = context.envelope.room
    fuzzy =
      room: room
      attachmentProperty: property
    @fuzzies.push(fuzzy)
    @save

    roomName = Utils.getRoomById(room).name

    @send context, "Now fuzzy matching attachment property `#{fuzzy.attachmentProperty}` in \##{roomName}"

  removeFuzzyMatch: (context) ->
    [ __, property ] = context.match
    room = context.envelope.room
    fuzzy =
      room: room
      attachmentProperty: property

    roomName = Utils.getRoomById(room).name

    if _.find(@fuzzies, fuzzy)
      @fuzzies = _.reject(@fuzzies, fuzzy)
      @save()
      @send context, "Removed fuzzy match for attachment property `#{fuzzy.attachmentProperty}` in \##{roomName}"
    else
      @send context, "No fuzzy matches for attachment property `#{fuzzy.attachmentProperty}` in \##{roomName}"

  showFuzzyMatch: (context) ->
    stringified = _.reduce(@fuzzies, (val, fuzzy) ->
        roomName = Utils.getRoomById(fuzzy.room).name
        return val + "attachment property #{fuzzy.attachmentProperty} in \##{roomName}\n"
    , "")
    @send context, """
      Fuzzy match list:
      ```#{stringified}```
    """

  fuzzyMatch: (context) ->
    attachments = context.message.rawMessage?.attachments
    fuzzy = _.findWhere(@fuzzies, { room: context.envelope.room })
    return unless attachments and fuzzy

    names = _.pluck(attachments, fuzzy.attachmentProperty)
    for name in names
      user = Utils.fuzzyFindChatUser(name)
      @send context, "<@#{user.id}> :point_up:" if user

module.exports = FuzzyBot
