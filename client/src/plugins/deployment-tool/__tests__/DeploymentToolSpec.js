/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

/* global sinon */

import React from 'react';

import { shallow } from 'enzyme';
import {
  omit
} from 'min-dash';

import { Config } from './../../../app/__tests__/mocks';

import DeploymentTool from '../DeploymentTool';
import AuthTypes from '../AuthTypes';


const CONFIG_KEY = 'deployment-tool';


describe('<DeploymentTool>', () => {

  it('should render', () => {
    createDeploymentTool();
  });


  describe('#deploy', () => {

    it('should derive deployment name from filename', async () => {

      // given
      const deploySpy = sinon.spy();
      const activeTab = createTab({ name: 'foo.bpmn' });
      const {
        instance
      } = createDeploymentTool({ activeTab, deploySpy });

      // when
      await instance.deploy();

      // then
      expect(deploySpy).to.have.been.calledOnce;
      expect(deploySpy.args[0][1]).to.have.property('deploymentName', 'foo');
    });


    it('should use saved config for deployed file', async () => {

      // given
      const config = new Config({
        getForFile: sinon.stub(),
        setForFile: sinon.spy(),
        getCredentials: sinon.stub()
      });
      const savedDetails = {
        endpointUrl: 'http://localhost:8088/engine-rest',
        tenantId: '',
        deploymentName: 'diagram',
        authType: AuthTypes.basic,
        username: 'demo',
        password: 'demo',
        rememberCredentials: false
      };

      config.getForFile.returns(omit(savedDetails, [ 'password' ]));
      config.getCredentials.returns({ password: 'demo' });

      const deploySpy = sinon.spy();

      const activeTab = createTab({ name: 'foo.bpmn' });

      const {
        instance
      } = createDeploymentTool({ activeTab, config, deploySpy });

      // when
      await instance.deploy();

      // then
      expect(deploySpy).to.have.been.calledOnce;
      expect(deploySpy.args[0]).to.eql([
        activeTab,
        {
          ...omit(savedDetails, [ 'username', 'password', 'rememberCredentials' ]),
          auth: {
            username: savedDetails.username,
            password: savedDetails.password
          }
        }
      ]);
    });


    it('should read and save config for deployed file', async () => {

      // given
      const config = new Config({
        getForFile: sinon.spy(),
        setForFile: sinon.spy()
      });
      const details = {
        endpointUrl: 'http://localhost:8088/engine-rest',
        tenantId: '',
        deploymentName: 'diagram',
        authType: AuthTypes.basic,
        username: 'demo',
        password: 'demo',
        rememberCredentials: false
      };

      const activeTab = createTab({ name: 'foo.bpmn' });

      const {
        instance
      } = createDeploymentTool({ activeTab, config, detailsFromUser: details });

      // when
      await instance.deploy();

      // then
      expect(config.getForFile).to.have.been.calledOnce;
      expect(config.getForFile.args[0]).to.eql([
        activeTab.file,
        CONFIG_KEY
      ]);

      expect(config.setForFile).to.have.been.calledOnce;
      expect(config.setForFile.args[0]).to.eql([
        activeTab.file,
        CONFIG_KEY,
        omit(details, [ 'password' ])
      ]);
    });


    it('should save credentials', async () => {

      // given
      const config = new Config({
        setCredentials: sinon.spy()
      });

      const details = {
        endpointUrl: 'http://localhost:8088/engine-rest',
        tenantId: '',
        deploymentName: 'diagram',
        authType: AuthTypes.basic,
        username: 'demo',
        password: 'demo',
        rememberCredentials: true
      };

      const activeTab = createTab({ name: 'foo.bpmn' });

      const {
        instance
      } = createDeploymentTool({ activeTab, config, detailsFromUser: details });

      // when
      await instance.deploy();

      // then
      expect(config.setCredentials).to.have.been.calledOnce;
      expect(config.setCredentials.args[0]).to.eql([
        CONFIG_KEY,
        `${details.authType}.${details.username}.${details.endpointUrl}`,
        { password: details.password }
      ]);
    });


    it('should not save credentials if `rememberCredentials` was set to false', async () => {

      // given
      const config = new Config({
        setCredentials: sinon.spy()
      });

      const details = {
        endpointUrl: 'http://localhost:8088/engine-rest',
        tenantId: '',
        deploymentName: 'diagram',
        authType: AuthTypes.basic,
        username: 'demo',
        password: 'demo',
        rememberCredentials: false
      };

      const activeTab = createTab({ name: 'foo.bpmn' });

      const {
        instance
      } = createDeploymentTool({ activeTab, config, detailsFromUser: details });

      // when
      await instance.deploy();

      // then
      expect(config.setCredentials).to.not.have.been.called;
    });


    it('should not save config if user cancelled the deployment', async () => {

      // given
      const config = new Config({
        setForFile: sinon.spy(),
        setCredentials: sinon.spy()
      });

      const activeTab = createTab({ name: 'foo.bpmn' });
      const {
        instance
      } = createDeploymentTool({ activeTab, config, detailsFromUser: false });

      // when
      await instance.deploy();

      // then
      expect(config.setForFile).to.not.have.been.called;
      expect(config.setCredentials).to.not.have.been.called;
    });


    it('should not save credentials if none were provided', async () => {

      // given
      const config = new Config({
        setForFile: sinon.spy(),
        setCredentials: sinon.spy()
      });

      const activeTab = createTab({ name: 'foo.bpmn' });
      const {
        instance
      } = createDeploymentTool({ activeTab, config, detailsFromUser: { authType: AuthTypes.none } });

      // when
      await instance.deploy();

      // then
      expect(config.setForFile).to.have.been.calledOnce;
      expect(config.setCredentials).to.not.have.been.called;
    });

  });
});



// helper ////
class TestDeploymentTool extends DeploymentTool {

  /**
   * @param {object} props
   * @param {object|boolean} [props.detailsFromUser] false to cancel deployment or values to override defaults
   */
  constructor(props) {
    super(props);
  }

  // removes CamundaAPI dependency
  deployWithDetails(...args) {
    this.props.deploySpy && this.props.deploySpy(...args);
  }

  checkConnection = (...args) => {
    this.props.checkConnectionSpy && this.props.checkConnectionSpy(...args);
  }

  // closes automatically when modal is opened
  componentDidUpdate(...args) {
    super.componentDidUpdate && super.componentDidUpdate(...args);

    const { modalState } = this.state;

    if (modalState) {
      const details = this.props.detailsFromUser !== false && {
        ...modalState.details,
        ...this.props.detailsFromUser
      };

      modalState.handleClose(details);
    }
  }
}

function createDeploymentTool({
  activeTab = createTab(),
  ...props
} = {}, render = shallow) {
  const subscribe = (event, callback) => {
    event === 'app.activeTabChanged' && callback(activeTab);
  };

  const triggerAction = event => {
    switch (event) {
    case 'save':
      return activeTab;
    }
  };

  const config = new Config();

  const wrapper = render(<TestDeploymentTool
    config={ config }
    subscribe={ subscribe }
    triggerAction={ triggerAction }
    displayNotification={ noop }
    log={ noop }
    { ...props }
  />);

  return {
    wrapper,
    instance: wrapper.instance()
  };
}

function createTab(overrides = {}) {
  return {
    id: 42,
    name: 'foo.bar',
    type: 'bar',
    title: 'unsaved',
    file: {
      name: 'foo.bar',
      contents: '',
      path: null
    },
    ...overrides
  };
}

function noop() {}
