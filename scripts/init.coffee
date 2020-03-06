# Description:
#   This bootstraps the hubot and loads all add-on bots
#
# Commands:
#   hal birthdays - Find out who has a birthday coming up
#   hal book a room - quickly book a meeting room for use right now
#   hal calendar link for @<group> - Will provide a vacation calendar for the specified user group (see slack directory)
#   hal die - forces hubot to restart
#   hal idea <idea summary>
#   hal on vacation - Find out who's on vacation right now

require('events').EventEmitter.prototype._maxListeners = 20; # Raise the max event emitter limit

bots =
  Build: require "../src/build"
  Fuzzy: require "../src/fuzzy"

module.exports = (robot) ->
  robot.logger.debug "Booting bots..."
  for name, bot of bots
    robot.logger.debug "Initializing #{name}"
    new bot robot
    robot.logger.debug "#{name} Ready"
