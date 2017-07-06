/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const p = require('lib/promise');
  const CoppaAgeInput = require('views/coppa/coppa-age-input');

  const CANNOT_CREATE_ACCOUNT_PATHNAME = 'cannot_create_account';

  module.exports = function (config = {}) {
    return {
      initialize (options = {}) {
        this._coppa = options.coppa;
        this._createView = options.createView;
      },

      beforeRender () {
        // TODO - perhaps make this check an option.
        // TODO - perhaps put a beforeSubmit here.
        if (document.cookie.indexOf('tooyoung') > -1) {
          this.navigate(CANNOT_CREATE_ACCOUNT_PATHNAME);
        }
      },

      /**
       * Create and render the COPPA view.
       *
       * @returns {Promise} resolves when complete
       */
      createCoppaView () {
        if (this._coppa) {
          return p();
        }

        var coppaOptions = {
          el: this.$('#coppa'),
          required: config.required,
          viewName: this.getViewName()
        };

        var coppaView = this._createView(CoppaAgeInput, coppaOptions);

        return coppaView.render()
          .then(() => {
            this.trackChildView(coppaView);
            // CoppaAgeInput inherits from FormView, which cancels submit events.
            // Explicitly propagate submit events from the COPPA input so that the
            // rest of our event-handling, e.g. the flow.engage event, works.
            coppaView.on('submit', () => this.trigger('submit'));

            this._coppa = coppaView;
          });
      },

      /**
       * Is the user old enough to sign up?
       *
       * @returns {Boolean}
       */
      isUserOldEnough () {
        return this._coppa.isUserOldEnough();
      },

      /**
       * Has the user filled out the COPPA input element?
       *
       * @returns {Boolean}
       */
      coppaHasValue () {
        return this._coppa.hasValue();
      },

      /**
       * Mark the user as too young. Navigates to
       * a page informing the user they are unable
       * to sign up.
       */
      tooYoung () {
        this.notifier.trigger('signup.tooyoung');

        // this is a session cookie. It will go away once:
        // 1. the user closes the tab
        // and
        // 2. the user closes the browser
        // Both of these have to happen or else the cookie
        // hangs around like a bad smell.
        document.cookie = 'tooyoung=1;';

        this.navigate(CANNOT_CREATE_ACCOUNT_PATHNAME);
      }
    };
  };
});
