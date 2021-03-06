/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern!object',
  'intern/chai!assert',
  'intern/dojo/node!lodash',
  'intern/dojo/node!os',
  'intern/dojo/node!path',
  'intern/dojo/node!proxyquire',
  'intern/dojo/node!sinon',
], (registerSuite, assert, _, os, path, proxyquire, sinon) => {
  var config, sandbox, mocks, flowEvent, flowMetricsValidateResult;

  registerSuite({
    name: 'flow-event',

    beforeEach () {
      config = {
        /*eslint-disable camelcase*/
        client_metrics: {
          stderr_collector_disabled: false
        },
        flow_id_expiry: 7200000,
        flow_id_key: 'foo'
        /*eslint-enable camelcase*/
      };
      sandbox = sinon.sandbox.create();
      sandbox.stub(process.stderr, 'write', () => {});
      mocks = {
        config: {
          get (key) {
            return config[key];
          }
        },
        flowMetrics: {
          validate: sandbox.spy(() => flowMetricsValidateResult)
        },
        request: {
          headers: {
            'user-agent': 'bar'
          }
        },
        time: 1479127399349
      };
      flowEvent = proxyquire(path.resolve('server/lib/flow-event'), {
        './configuration': mocks.config,
        './flow-metrics': mocks.flowMetrics
      });
    },

    afterEach () {
      sandbox.restore();
    },

    'interface is correct': () => {
      assert.isFunction(flowEvent);
      assert.lengthOf(flowEvent, 3);
    },

    'call flowEvent with valid flow data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        flowMetricsValidateResult = true;
        setup({
          events: [
            { offset: 5, type: 'wibble' },
            { offset: 5, type: 'flow.begin' },
            { offset: 5.9, type: 'screen.signup' },
            { offset: timeSinceFlowBegin, type: 'flow.signup.good-offset-now' },
            { offset: timeSinceFlowBegin + 1, type: 'flow.signup.bad-offset-future' },
            { offset: timeSinceFlowBegin - config.flow_id_expiry - 1, type: 'flow.signup.bad-offset-expired' },
            { offset: timeSinceFlowBegin - config.flow_id_expiry, type: 'flow.signup.good-offset-oldest' }
          ],
        }, timeSinceFlowBegin);
      },

      'process.stderr.write was called four times': () => {
        assert.equal(process.stderr.write.callCount, 4);
      },

      'first call to process.stderr.write was correct': () => {
        const args = process.stderr.write.args[0];
        assert.lengthOf(args, 1);
        assert.equal(args[0][args[0].length - 1], '\n');
        assert.deepEqual(JSON.parse(args[0]), {
          /*eslint-disable camelcase*/
          context: 'fx_desktop_v3',
          entrypoint: 'menupanel',
          event: 'flow.begin',
          flow_id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flow_time: 0,
          hostname: os.hostname(),
          migration: 'sync11',
          op: 'flowEvent',
          pid: process.pid,
          service: '1234567890abcdef',
          time: new Date(mocks.time - 1000).toISOString(),
          userAgent: mocks.request.headers['user-agent'],
          utm_campaign: '.-Mock%20utm_campaign',
          utm_content: '.-Mock%20utm_content',
          utm_medium: '.-Mock%20utm_medium',
          utm_source: '.-Mock%20utm_source',
          v: 1
          /*eslint-enable camelcase*/
        });
      },

      'second call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[1][0]);
        assert.lengthOf(Object.keys(arg), 17);
        assert.equal(arg.event, 'flow.signup.view');
        assert.equal(arg.flow_time, 5);
        assert.equal(arg.time, new Date(mocks.time - 995).toISOString());
      },

      'third call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[2][0]);
        assert.lengthOf(Object.keys(arg), 17);
        assert.equal(arg.event, 'flow.signup.good-offset-now');
        assert.equal(arg.time, new Date(mocks.time).toISOString());
      },

      'fourth call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[3][0]);
        assert.lengthOf(Object.keys(arg), 17);
        assert.equal(arg.event, 'flow.signup.good-offset-oldest');
        assert.equal(arg.time, new Date(mocks.time - config.flow_id_expiry).toISOString());
      }
    },

    'call flowEvent with performance data': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          events: [
            { offset: 2000, type: 'loaded' }
          ],
          initialView: 'signup'
        }, 2000);
      },

      'process.stderr.write was called four times': () => {
        assert.equal(process.stderr.write.callCount, 4);
      },

      'first call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.event, 'flow.performance.auth');
        assert.equal(arg.time, new Date(mocks.time).toISOString());
        assert.equal(arg.flow_time, 2000);
      },

      'second call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[1][0]);
        assert.equal(arg.event, 'flow.performance.auth.network');
        assert.equal(arg.time, new Date(mocks.time - 2000 + 300).toISOString());
        assert.equal(arg.flow_time, 300);
      },

      'third call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[2][0]);
        assert.equal(arg.event, 'flow.performance.auth.server');
        assert.equal(arg.time, new Date(mocks.time - 2000 + 100).toISOString());
        assert.equal(arg.flow_time, 100);
      },

      'fourth call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[3][0]);
        assert.equal(arg.event, 'flow.performance.auth.client');
        assert.equal(arg.time, new Date(mocks.time - 2000 + 200).toISOString());
        assert.equal(arg.flow_time, 200);
      }
    },

    'call flowEvent with invalid flow id': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          flowId: '1234567890abcdef1234567890abcdef'
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with invalid flow begin time': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          flowBeginTime: mocks.time + 1
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with string flow begin time': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          flowBeginTime: `${mocks.time - 1000}`
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with invalid context': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          context: '!'
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with invalid entrypoint': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          entrypoint: '!'
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with invalid migration': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          migration: 'sync111'
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with invalid service': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          service: '1234567890abcdef1234567890abcdef'
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent without optional flow data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called once': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.isUndefined(arg.context);
        assert.isUndefined(arg.entrypoint);
        assert.isUndefined(arg.migration);
        assert.isUndefined(arg.service);
        assert.isUndefined(arg.utm_campaign);
        assert.isUndefined(arg.utm_content);
        assert.isUndefined(arg.utm_medium);
        assert.isUndefined(arg.utm_source);
        assert.isUndefined(arg.utm_term);
      }
    },

    'call flowEvent without flow id': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent without flow begin time': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with valid-seeming flow data but flowMetrics.validate returns false': {
      beforeEach () {
        flowMetricsValidateResult = false;
        setup({}, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent without flow event': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          events: [
            { offset: 0, type: 'blargh' }
          ]
        }, 1000);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with client_id': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          client_id: 'deadbeefbaadf00d', //eslint-disable-line camelcase
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.service, 'deadbeefbaadf00d');
      }
    },

    'call flowEvent with invalid client_id': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          client_id: 'deadbeef', //eslint-disable-line camelcase
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with service and client_id': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          client_id: 'deadbeefbaadf00d', //eslint-disable-line camelcase
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          service: '1234567890abcdef',
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.service, '1234567890abcdef');
      }
    },

    'call flowEvent with entryPoint': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          entryPoint: 'menubar',
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.entrypoint, 'menubar');
      }
    },

    'call flowEvent with invalid entryPoint': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          entryPoint: '!',
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was not called': () => {
        assert.equal(process.stderr.write.callCount, 0);
      }
    },

    'call flowEvent with entrypoint and entryPoint': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          entryPoint: 'menubar',
          entrypoint: 'menupanel',
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.entrypoint, 'menupanel');
      }
    },

    'call flowEvent with 101-character data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          context: new Array(102).join('0'),
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(arg.context, 100);
      }
    },

    'call flowEvent with 100-character data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          entrypoint: new Array(101).join('0'),
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(arg.entrypoint, 100);
      }
    },

    'call flowEvent with 101-character entryPoint': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          entryPoint: new Array(102).join('x'), //eslint-disable-line camelcase
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(arg.entrypoint, 100);
      }
    },

    'call flowEvent with "none" data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          migration: 'none',
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.isUndefined(arg.migration);
      }
    },

    'call flowEvent with falsy data': {
      beforeEach () {
        const timeSinceFlowBegin = 1000;
        const flowBeginTime = mocks.time - timeSinceFlowBegin;
        flowMetricsValidateResult = true;
        flowEvent(mocks.request, {
          events: [
            { offset: 0, type: 'flow.begin' }
          ],
          flowBeginTime,
          flowId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          flushTime: flowBeginTime,
          service: 0,
          startTime: flowBeginTime - timeSinceFlowBegin,
        }, mocks.time);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.isUndefined(arg.service);
      }
    },

    'call flowEvent with DNT header': {
      beforeEach () {
        flowMetricsValidateResult = true;
        mocks.request.headers.dnt = '1';
        setup({}, 1000);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.isUndefined(arg.utm_campaign);
        assert.isUndefined(arg.utm_content);
        assert.isUndefined(arg.utm_medium);
        assert.isUndefined(arg.utm_source);
        assert.isUndefined(arg.utm_term);
      }
    },

    'call flowEvent with invalid utm_campaign': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          utm_campaign: '!' //eslint-disable-line camelcase
        }, 1000);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(Object.keys(arg), 16);
        assert.isUndefined(arg.utm_campaign); //eslint-disable-line camelcase
      }
    },

    'call flowEvent with invalid utm_content': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          utm_content: '"' //eslint-disable-line camelcase
        }, 1000);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(Object.keys(arg), 16);
        assert.isUndefined(arg.utm_content); //eslint-disable-line camelcase
      }
    },

    'call flowEvent with invalid utm_medium': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          utm_medium: ';' //eslint-disable-line camelcase
        }, 1000);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(Object.keys(arg), 16);
        assert.isUndefined(arg.utm_medium); //eslint-disable-line camelcase
      }
    },

    'call flowEvent with invalid utm_source': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          utm_source: '>' //eslint-disable-line camelcase
        }, 1000);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.lengthOf(Object.keys(arg), 16);
        assert.isUndefined(arg.utm_source); //eslint-disable-line camelcase
      }
    },

    'call flowEvent with invalid loaded timing': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          events: [
            // The value of offset here puts the loaded event in the distant future
            { offset: 31536000000, type: 'loaded' }
          ],
          initialView: 'settings'
        }, 1000);
      },

      'process.stderr.write was called three times': () => {
        assert.equal(process.stderr.write.callCount, 3);
      },

      'second call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.event, 'flow.performance.other.network');
      },

      'third call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[1][0]);
        assert.equal(arg.event, 'flow.performance.other.server');
      },

      'fourth call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[2][0]);
        assert.equal(arg.event, 'flow.performance.other.client');
      }
    },

    'call flowEvent with invalid navigationTiming': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          events: [
            { offset: 1000, type: 'loaded' }
          ],
          initialView: 'reset-password'
        // The last arg here puts the navtiming events in the distant future
        }, 1000, false, 31536000000);
      },

      'process.stderr.write was called once': () => {
        assert.equal(process.stderr.write.callCount, 1);
      },

      'first call to process.stderr.write was correct': () => {
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.event, 'flow.performance.other');
      }
    },

    'call flowEvent without navigationTiming data': {
      beforeEach () {
        flowMetricsValidateResult = true;
        setup({
          events: [
            { offset: 2000, type: 'loaded' }
          ],
          initialView: 'signin'
        }, 2000, true);
      },

      'process.stderr.write was called correctly': () => {
        assert.equal(process.stderr.write.callCount, 1);
        const arg = JSON.parse(process.stderr.write.args[0][0]);
        assert.equal(arg.event, 'flow.performance.auth');
      }
    }
  });

  function setup (data, timeSinceFlowBegin, clobberNavigationTiming, navigationTimingValue) {
    try {
      const flowBeginTime = data.flowBeginTime || mocks.time - timeSinceFlowBegin;
      flowEvent(mocks.request, {
        context: data.context || 'fx_desktop_v3',
        entrypoint: data.entrypoint || 'menupanel',
        events: data.events || [
          { offset: 0, type: 'flow.begin' }
        ],
        flowBeginTime,
        flowId: data.flowId || '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        flushTime: flowBeginTime,
        initialView: data.initialView || 'signup',
        migration: data.migration || 'sync11',
        navigationTiming: clobberNavigationTiming ? null : {
          /*eslint-disable sorting/sort-object-props*/
          domainLookupStart: navigationTimingValue || 100,
          domainLookupEnd: navigationTimingValue || 200,
          connectStart: navigationTimingValue || 300,
          connectEnd: navigationTimingValue || 400,
          requestStart: navigationTimingValue || 500,
          responseStart: navigationTimingValue || 600,
          responseEnd: navigationTimingValue || 700,
          domLoading: navigationTimingValue || 800,
          domComplete: navigationTimingValue || 1000
          /*eslint-enable sorting/sort-object-props*/
        },
        service: data.service || '1234567890abcdef',
        startTime: flowBeginTime - timeSinceFlowBegin,
        /*eslint-disable camelcase*/
        utm_campaign: data.utm_campaign || '.-Mock%20utm_campaign',
        utm_content: data.utm_content || '.-Mock%20utm_content',
        utm_medium: data.utm_medium || '.-Mock%20utm_medium',
        utm_source: data.utm_source || '.-Mock%20utm_source',
        utm_term: data.utm_term || '.-Mock%20utm_term',
        /*eslint-enable camelcase*/
        zignore: 'ignore me'
      }, mocks.time);
    } catch (err) {
      console.error(err.stack);
    }
  }
});
