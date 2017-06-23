/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const AuthErrors = require('lib/auth-errors');
  const BackMixin = require('views/mixins/back-mixin');
  const CheckboxMixin = require('views/mixins/checkbox-mixin');
  const Cocktail = require('cocktail');
  const CoppaMixin = require('views/mixins/coppa-mixin');
  const EmailOptInMixin = require('views/mixins/email-opt-in-mixin');
  const FormPrefillMixin = require('views/mixins/form-prefill-mixin');
  const FormView = require('views/form');
  const PasswordMixin = require('views/mixins/password-mixin');
  const ResumeTokenMixin = require('views/mixins/resume-token-mixin');
  const ServiceMixin = require('views/mixins/service-mixin');
  const SignUpMixin = require('views/mixins/signup-mixin');
  const Template = require('stache!templates/sign_up_password');

  class SignUpPasswordView extends FormView {
    constructor (options) {
      super(options);

      this.template = Template;
    }

    beforeRender () {
      if (! this._account) {
        this.navigate('email');
      }
    }

    afterRender () {
      return this.createCoppaView()
        .then(() => super.afterRender());
    }

    setInitialContext (context) {
      context.set(this._account.pick('email'));
    }

    submit () {
      if (! this.isUserOldEnough()) {
        return this.tooYoung();
      }

      this._account.set('needsOptedInToMarketingEmail', this.hasOptedInToEmail());
      return this.signUp(this._account, this._password);
    }

    isValidEnd () {
      return this._doPasswordsMatch();
    }

    showValidationErrorsEnd () {
      if (! this._doPasswordsMatch()) {
        this.displayError( AuthErrors.toError('PASSWORDS_DO_NOT_MATCH'));
        this.$('#vpassword,#password').addClass('invalid');
      }
    }

    _doPasswordsMatch () {
      return this._password === this._vpassword;
    }

    get _account () {
      return this.model.get('account');
    }

    get _password () {
      return this.getElementValue('#password');
    }

    get _vpassword () {
      return this.getElementValue('#vpassword');
    }
  }

  Cocktail.mixin(
    SignUpPasswordView,
    BackMixin,
    CheckboxMixin,
    CoppaMixin({
      required: true
    }),
    EmailOptInMixin,
    FormPrefillMixin,
    PasswordMixin,
    ResumeTokenMixin,
    ServiceMixin,
    SignUpMixin
  );

  module.exports = SignUpPasswordView;
});
