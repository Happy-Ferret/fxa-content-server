/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  module.exports = {
    initialize (options) {
      this._formPrefill = options.formPrefill;
    },

    afterRender () {
      this.$('[data-form-prefill]').each((index, el) => {
        const $el = this.$(el);
        const key = $el.data('form-prefill');
        if (this._formPrefill.has(key)) {
          $el.val(this._formPrefill.get(key));
        }
      });

      this.enableSubmitIfValid();
    },

    beforeDestroy () {
      this.$('[data-form-prefill]').each((index, el) => {
        const $el = this.$(el);
        const key = $el.data('form-prefill');
        this._formPrefill.set(key, $el.val());
      });
    }
  };
});
