/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, FunctionalHelpers) {
  var EXP_MAILCHECK_URL = intern.config.fxaContentRoot + 'signup?automatedBrowser=true';

  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var click = FunctionalHelpers.click;
  var openPage = FunctionalHelpers.openPage;
  var testElementValueEquals = FunctionalHelpers.testElementValueEquals;
  var type = FunctionalHelpers.type;

  registerSuite({
    name: 'mailcheck',

    beforeEach: function () {
      return this.remote.then(clearBrowserState());
    },

    afterEach: function () {
      return this.remote.then(clearBrowserState());
    },

    'tooltip works': function () {
      var BAD_EMAIL = 'something@gnail.com';
      var CORRECTED_EMAIL = 'something@gmail.com';

      return this.remote
        .then(openPage(EXP_MAILCHECK_URL, '#fxa-signup-header'))
        .then(type('.email', BAD_EMAIL))
        .then(click('#password'))
        .then(click('.tooltip-suggest > span:nth-child(1)'))

        .then(testElementValueEquals('input[type=email]', CORRECTED_EMAIL));
    }
  });
});
