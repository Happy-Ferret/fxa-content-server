/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const $ = require('jquery');
  const Account = require('models/account');
  const { assert } = require('chai');
  const AuthBroker = require('models/auth_brokers/base');
  const Backbone = require('backbone');
  const Notifier = require('lib/channels/notifier');
  const Relier = require('models/reliers/relier');
  const sinon = require('sinon');
  const User = require('models/user');
  const View = require('views/connect_another_device');
  const WindowMock = require('../../mocks/window');

  describe('views/connect_another_device', () => {
    let account;
    let broker;
    let model;
    let notifier;
    let relier;
    let user;
    let view;
    let windowMock;

    beforeEach(() => {
      account = new Account();

      relier = new Relier();
      broker = new AuthBroker( { relier });
      broker.setCapability('emailVerificationMarketingSnippet', true);

      model = new Backbone.Model({ account });
      windowMock = new WindowMock();

      notifier = new Notifier();
      sinon.spy(notifier, 'trigger');

      user = new User();

      view = new View({
        broker,
        model,
        notifier,
        relier,
        user,
        window: windowMock
      });
      sinon.spy(view, 'logFlowEvent');
    });

    afterEach(() => {
      view.destroy(true);
      view = null;
    });

    function testIsFlowEventLogged(eventName) {
      assert.isTrue(view.logFlowEvent.calledWith(eventName), eventName);
    }

    describe('render/afterVisible', () => {
      describe('with a Fx desktop user that is signed in', () => {
        beforeEach(() => {
          sinon.stub(user, 'isSignedInAccount', () => true);
          windowMock.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:55.0) Gecko/20100101 Firefox/55.0';

          return view.render()
            .then(() => {
              view.afterVisible();
            });
        });

        it('shows the marketing area, logs appropriately', () => {
          assert.lengthOf(view.$('.marketing-area'), 1);
          testIsFlowEventLogged('signedin.true');
          testIsFlowEventLogged('signin.ineligible');
          testIsFlowEventLogged('install_from.fx_desktop');
        });
      });

      describe('with a fennec user that is signed in', () => {
        beforeEach(() => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => true,
              isFirefox: () => true,
              isFirefoxAndroid: () => true,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          sinon.stub(user, 'isSignedInAccount', () => true);

          return view.render()
            .then(() => {
              view.afterVisible();
            });
        });

        it('shows the marketing area, logs appropriately', () => {
          assert.lengthOf(view.$('.marketing-area'), 1);
          testIsFlowEventLogged('signedin.true');
          testIsFlowEventLogged('signin.ineligible');
          testIsFlowEventLogged('install_from.fx_android');
        });
      });

      describe('with a Fx desktop user that can sign in', () => {
        beforeEach(() => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => false,
              isFirefox: () => true,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => true,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          account.set('email', 'testuser@testuser.com');
          sinon.stub(user, 'isSignedInAccount', () => false);
          sinon.stub(view, '_canSignIn', () => true);

          return view.render()
            .then(() => {
              view.afterVisible();
            });
        });

        it('shows a sign in button with the appropriate link, logs appropriately', () => {
          assert.lengthOf(view.$('#signin'), 1);
          testIsFlowEventLogged('signedin.false');
          testIsFlowEventLogged('signin.eligible');
          testIsFlowEventLogged('signin_from.fx_desktop');
        });
      });

      describe('with a fennec user that can sign in', () => {
        beforeEach(() => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => true,
              isFirefox: () => true,
              isFirefoxAndroid: () => true,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          account.set('email', 'testuser@testuser.com');
          sinon.stub(user, 'isSignedInAccount', () => false);
          sinon.stub(view, '_canSignIn', () => true);

          return view.render()
            .then(() => {
              view.afterVisible();
            });
        });

        it('shows a sign in button with the appropriate link, logs appropriately', () => {
          assert.lengthOf(view.$('#signin'), 1);
          testIsFlowEventLogged('signedin.false');
          testIsFlowEventLogged('signin.eligible');
          testIsFlowEventLogged('signin_from.fx_android');
        });
      });

      describe('with a user that cannot sign in', () => {
        beforeEach(() => {
          sinon.stub(user, 'isSignedInAccount', () => false);
          sinon.stub(view, '_canSignIn', () => false);
        });

        it('shows FxiOS help text, no marketing area to users on FxiOS', () => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => false,
              isFirefox: () => true,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => true,
              isIos: () => true,
            };
          });

          return view.render()
            .then(() => {
              view.afterVisible();

              assert.lengthOf(view.$('#signin-fxios'), 1);
              assert.lengthOf(view.$('.marketing-area'), 0);
              testIsFlowEventLogged('signin_from.fx_ios');
            });
        });

        it('shows iOS text, marketing area to users on iOS', () => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => false,
              isFirefox: () => false,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => false,
              isIos: () => true,
            };
          });

          return view.render()
            .then(() => {
              view.afterVisible();

              assert.lengthOf(view.$('#install-mobile-firefox-ios'), 1);
              assert.lengthOf(view.$('.marketing-area'), 1);
              testIsFlowEventLogged('install_from.other_ios');
            });
        });

        it('shows Android text, marketing area to users on Android', () => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => true,
              isFirefox: () => false,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          return view.render()
            .then(() => {
              view.afterVisible();

              assert.lengthOf(view.$('#install-mobile-firefox-android'), 1);
              assert.lengthOf(view.$('.marketing-area'), 1);
              testIsFlowEventLogged('install_from.other_android');
            });
        });

        it('shows FxDesktop text, marketing area to Fx Desktop users', () => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => false,
              isFirefox: () => true,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => true,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          return view.render()
            .then(() => {
              view.afterVisible();

              assert.lengthOf(view.$('#install-mobile-firefox-desktop'), 1);
              assert.lengthOf(view.$('.marketing-area'), 1);
              testIsFlowEventLogged('install_from.fx_desktop');
            });
        });

        it('shows Other text, marketing area to everyone else', () => {
          sinon.stub(view, 'getUserAgent', () => {
            return {
              isAndroid: () => false,
              isFirefox: () => false,
              isFirefoxAndroid: () => false,
              isFirefoxDesktop: () => false,
              isFirefoxIos: () => false,
              isIos: () => false
            };
          });

          return view.render()
            .then(() => {
              view.afterVisible();

              assert.lengthOf(view.$('#install-mobile-firefox-other'), 1);
              assert.lengthOf(view.$('.marketing-area'), 1);
              testIsFlowEventLogged('install_from.other');
            });
        });
      });
    });

    describe('_isSignedIn', () => {
      it('delegates to user.isSignedInAccount', () => {
        sinon.stub(user, 'isSignedInAccount', () => true);

        assert.isTrue(view._isSignedIn());
        assert.isTrue(user.isSignedInAccount.calledOnce);
        assert.isTrue(user.isSignedInAccount.calledWith(account));
      });
    });

    describe('_canSignIn', () => {
      it('returns `false` if user is signed in', () => {

        sinon.stub(user, 'isSignedInAccount', () => true);
        sinon.stub(view, 'isSyncAuthSupported', () => true);

        assert.isFalse(view._canSignIn());
      });

      it('returns `false` if sync authentication not supported', () => {
        sinon.stub(user, 'isSignedInAccount', () => false);
        sinon.stub(view, 'isSyncAuthSupported', () => false);

        assert.isFalse(view._canSignIn());
      });

      it('returns `true` if not signed in, sync authentication supported', () => {
        sinon.stub(user, 'isSignedInAccount', () => false);
        sinon.stub(view, 'isSyncAuthSupported', () => true);

        assert.isTrue(view._canSignIn());
      });
    });


    describe('_getEscapedSignInUrl', () => {
      const SYNC_URL = 'https://accounts.firefox.com/signin?context=fx_desktop_v3&service=sync&email=testuser@testuser.com';

      beforeEach(() => {
        sinon.stub(view, 'getEscapedSyncUrl', () => SYNC_URL);
      });

      it('returns the expected URL', () => {
        assert.equal(
          view._getEscapedSignInUrl('testuser@testuser.com'),
          SYNC_URL
        );

        assert.isTrue(view.getEscapedSyncUrl.calledOnce);
        assert.isTrue(view.getEscapedSyncUrl.calledWith(
            'signin', View.ENTRYPOINT, { email: 'testuser@testuser.com' }));
      });
    });

    describe('clicks', () => {
      beforeEach(() => {
        sinon.stub(view, 'getUserAgent', () => {
          return {
            isAndroid: () => false,
            isFirefox: () => true,
            isFirefoxAndroid: () => false,
            isFirefoxDesktop: () => true,
            isFirefoxIos: () => false,
            isIos: () => false
          };
        });

        account.set('email', 'testuser@testuser.com');
        sinon.stub(user, 'isSignedInAccount', () => false);
        sinon.stub(view, '_canSignIn', () => true);

        return view.render()
          .then(() => {
            $('#container').html(view.el);
          });
      });

      describe('click on sign-in', () => {
        beforeEach(() => {
          view.$('#signin').click();
        });

        it('notifies of click', () => {
          testIsFlowEventLogged('link.signin');
        });
      });

      describe('click on `why`', () => {
        beforeEach(() => {
          view.$('a[href="/connect_another_device/why"]').click();
        });

        it('notifies of click', () => {
          testIsFlowEventLogged('link.why');
        });
      });
    });
  });
});
