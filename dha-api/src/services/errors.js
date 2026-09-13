'use strict';

function sendError(ctx, status, code, message, details = undefined) {
  ctx.status = status;
  ctx.body = {
    error: {
      code,
      message,
      details,
    },
  };
}

module.exports = {
  sendError,
};
