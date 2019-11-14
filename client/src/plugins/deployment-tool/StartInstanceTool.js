/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import React, { PureComponent } from 'react';

import { pick } from 'min-dash';

import CamundaAPI from './CamundaAPI';
import StartInstanceDetailsModal from './StartInstanceDetailsModal';
import getEditMenu from './getEditMenu';
import isExecutable from './util/isExecutable';

import css from './StartInstanceTool.less';

import { Fill } from '../../app/slot-fill';

import {
  Button,
  DropdownButton,
  Icon
} from '../../app/primitives';

const START_CONFIG_KEY = 'start-instance-config';

export default class StartInstanceTool extends PureComponent {

  state = {
    startModalState: null,
    activeTab: null,
    enabled: false
  }

  componentDidMount() {

    const {
      deployRef,
      subscribe
    } = this.props;

    subscribe('app.activeTabChanged', ({ activeTab, tabState }) => {
      this.setState({ activeTab });
      this.setExecutable(tabState);
    });

    subscribe('tab.changed', ({ tab, properties }) => {

      const {
        activeTab
      } = this.state;

      if (activeTab === tab) {
        this.setExecutable(properties);
      }
    });

    this.START_ACTIONS = [
      {
        name: 'Start process again',
        onClick: this.startInstance.bind(this)
      },
      {
        name: 'Start process with new configuration',
        onClick: () => {
          this.startActiveTab(true);
        }
      }
    ];

    // todo(pinussilvestrus): is there's a better way?
    this.deployWithDetails = deployRef.current.deployWithDetails.bind(deployRef).bind(deployRef.current);
    this.getSavedDeploymentDetails = deployRef.current.getSavedDeploymentDetails.bind(deployRef.current);
    this.saveProcessDefinition = deployRef.current.saveProcessDefinition.bind(deployRef.current);
    this.deployTab = deployRef.current.deployTab.bind(deployRef.current);
    this.getDeployDetailsFromUserInput = deployRef.current.getDeployDetailsFromUserInput.bind(deployRef.current);
    this.saveDeployDetails = deployRef.current.saveDeployDetails.bind(deployRef.current);
    this.checkConnection = deployRef.current.checkConnection.bind(deployRef.current);
  }

  setExecutable({ executable }) {
    this.setState({
      enabled: executable
    });
  }

  saveTab() {
    const {
      triggerAction
    } = this.props;

    return triggerAction('save');
  }

  startInstance = () => {
    this.startActiveTab();
  }

  async ensureVersionDeployed(tab, details) {

    const {
      displayNotification,
      log
    } = this.props;

    // try to deploy current diagram version
    try {
      const deployResult = await this.deployWithDetails(tab, details);
      await this.saveProcessDefinition(tab, deployResult.deployedProcessDefinition);
    } catch (error) {
      displayNotification({
        type: 'error',
        title: 'Deployment failed',
        content: 'See the log for further details.',
        duration: 10000
      });
      log({ category: 'deploy-error', message: error.problems || error.message });

      return;
    }

    // return process definition for new version or last saved one
    return await this.getSavedProcessDefinition(tab);
  }

  async ensureDeploymentDetails(tab) {

    let details = await this.getSavedDeploymentDetails(tab);

    details = await this.getDeployDetailsFromUserInput(tab, details, {
      title: DeployStepTitle(),
      intro: DeployIntro(),
      primaryAction: 'Next'
    });

    // handle user cancelation
    if (!details) {
      return;
    }

    await this.saveDeployDetails(tab, details);

    return details;
  }

  // todo(pinussilvestrus): refactor flags
  async startActiveTab(forceModal = false) {

    const {
      displayNotification,
      log
    } = this.props;

    // (0) Make sure diagram is up to date
    const tab = await this.saveTab();

    if (!tab) {
      return;
    }

    let deploymentDetails = await this.getSavedDeploymentDetails(tab);

    // (1) Check connection to engine
    const hasError = deploymentDetails ? await this.checkConnection(deploymentDetails): true;

    // (1.1) Ensure deployment details
    if (hasError) {
      deploymentDetails = await this.ensureDeploymentDetails(tab);
    }

    // this indicates user cancelation in the deploy step,
    if (!deploymentDetails) {
      return;
    }

    // (2) Ensure current diagram version is deployed
    const processDefinition = await this.ensureVersionDeployed(tab, deploymentDetails);

    // Assumption: error occurred while deploying and notification was shown
    if (!processDefinition) {
      return;
    }

    // (3) Get start details
    let startDetails = await this.getSavedStartDetails(tab);

    const canStart = startDetails && this.canStartWithDetails(startDetails);

    if (!canStart || forceModal) {

      // (3.1) Open Modal to enter start details
      startDetails = await this.getStartDetailsFromUserInput(tab, startDetails);

      if (!startDetails) {
        return;
      }

      await this.saveStartDetails(tab, startDetails);
    }

    startDetails = {
      ...startDetails,
      endpointUrl: deploymentDetails.endpointUrl,
      auth: deploymentDetails.auth
    };

    // (4) Trigger start instance
    try {
      const processInstance = await this.startWithDetails(startDetails, processDefinition);

      this.showStartSuccessNotification(processInstance, startDetails);
    } catch (error) {
      displayNotification({
        type: 'error',
        title: 'Starting process instance failed',
        content: 'See the log for further details.',
        duration: 10000
      });
      log({ category: 'start-instance-error', message: error.problems || error.message });
    }
  }

  async saveStartDetails(tab, details) {
    const {
      config
    } = this.props;

    const savedDetails = this.getStartDetailsToSave(details);

    return config.setForFile(tab.file, START_CONFIG_KEY, savedDetails);
  }

  canStartWithDetails(details) {

    const {
      businessKey
    } = details;

    return !!businessKey;
  }

  async getSavedStartDetails(tab) {
    const {
      config
    } = this.props;

    return config.getForFile(tab.file, START_CONFIG_KEY);
  }

  async getSavedProcessDefinition(tab) {
    const {
      config
    } = this.props;

    return config.getForFile(tab.file, 'process-definition');
  }

  getStartDetailsFromUserInput(tab, details) {
    return new Promise(resolve => {
      const handleClose = result => {

        this.setState({
          startModalState: null
        });

        this.updateMenu();

        // contract: if details provided, user closed with O.K.
        // otherwise they canceled it
        if (result) {
          return resolve(result);
        }
      };

      this.setState({
        startModalState: {
          tab,
          details,
          handleClose
        }
      });
    });
  }

  startWithDetails(details, deployedProcessDefinition) {
    const api = new CamundaAPI(details.endpointUrl);

    return api.startInstance(deployedProcessDefinition, details);
  }

  showStartSuccessNotification(processInstance, details) {
    const {
      displayNotification
    } = this.props;

    const {
      endpointUrl
    } = details;

    displayNotification({
      type: 'error',
      title: 'Process started successfully',
      content: (CockpitLink(endpointUrl, processInstance)),
      duration: 10000
    });
  }

  getStartDetailsToSave(rawDetails) {
    return pick(rawDetails, [ 'businessKey' ]);
  }

  handleFocusChange = event => {
    const editMenu = getEditMenu(isFocusedOnInput(event));

    this.updateMenu({ editMenu });
  }

  updateMenu(menu) {
    this.props.triggerAction('update-menu', menu);
  }

  render() {
    const {
      startModalState,
      enabled
    } = this.state;

    return <React.Fragment>

      <Fill slot="toolbar" group="8_deploy">
        <Button
          onClick={ this.startInstance }
          disabled={ !enabled }
          title="Start Current Diagram"
        >
          <Icon name="play" />
        </Button>
        <DropdownButton
          disabled={ !enabled }
          className={ css.DropdownButton }
          items={ () => this.START_ACTIONS.map(DropdownItem) }
        ></DropdownButton>
      </Fill>

      { startModalState &&
      <StartInstanceDetailsModal
        details={ startModalState.details }
        activeTab={ startModalState.tab }
        onClose={ startModalState.handleClose }
        onFocusChange={ this.handleFocusChange }
      /> }
    </React.Fragment>;
  }

}


function DropdownItem(action, key) {

  const {
    name,
    onClick
  } = action;

  return (
    <div
      key={ key }
      className='dropdown-item'
      onClick={ onClick }>
      <span>{ name }</span>
    </div>
  );
}

function CockpitLink(endpointUrl, processInstance) {
  const {
    id
  } = processInstance;

  const baseUrl = getBaseUrl(endpointUrl);

  const cockpitUrl = `${baseUrl}/camunda/app/cockpit/default/#/process-instance/${id}`;

  return (
    <div className={ css.CockpitLink }>
      <a href={ cockpitUrl }>
        Open Instance in Camunda Cockpit
        <Icon name="open" />
      </a>
    </div>
  );
}

function DeployStepTitle() {
  return (
    <div>Start Process Instance <b>Step 1/2</b></div>
  );
}

function DeployIntro() {
  return (
    <p className="intro">
        Specify deployment details to deploy this diagram to Camunda.
    </p>
  );
}


// helpers //////////
function isFocusedOnInput(event) {
  return event.type === 'focus' && ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
}

function getBaseUrl(url) {
  const [ protocol,, host ] = url.split('/');

  return `${protocol}//${host}`;
}
