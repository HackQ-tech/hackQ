const Notification = require('../models/Notification');
// types: mention | comment | reply | reaction | follow | post | system
exports.notify = ({ user, actor, type = 'system', text, link }) => {
  if (!user || (actor && String(user) === String(actor))) return;
  Notification.create({ user, actor, type, text, link }).catch(() => {});
};
