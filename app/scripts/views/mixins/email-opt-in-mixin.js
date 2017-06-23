/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  module.exports = {
    initialize (options = {}) {
      this._experimentGroupingRules = options.experimentGroupingRules;
    },

    setInitialContext (context) {
      context.set('isEmailOptInVisible', this._isEmailOptInEnabled());
    },

    afterRender () {
      this.logViewEvent(`email-optin.visible.${String(this._isEmailOptInEnabled())}`);
    },

    _isEmailOptInEnabled () {
      return !! this._experimentGroupingRules.choose('communicationPrefsVisible', {
        lang: this.navigator.language
      });
    },

    hasOptedInToEmail () {
      return this.$('.marketing-email-optin').is(':checked');
    }
  };
});
