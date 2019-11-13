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

import AuthTypes from './AuthTypes';
import CamundaAPI from './CamundaAPI';
import StartInstanceDetailsModal from './StartInstanceDetailsModal';
import getEditMenu from './getEditMenu';
import validators from './validators';

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
    activeTab: null
  }

  componentDidMount() {

    const {
      deployRef,
      subscribe
    } = this.props;

    subscribe('app.activeTabChanged', activeTab => {
      this.setState({ activeTab });
    });

    this.START_ACTIONS = [
      {
        name: 'Start Process Instance again',
        onClick: this.startInstance.bind(this)
      },
      {
        name: 'Start Process Instance with new Configuration',
        onClick: () => {
          const {
            activeTab
          } = this.state;

          this.startTab(activeTab, true);
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
  }

  saveTab() {
    const {
      triggerAction
    } = this.props;

    return triggerAction('save');
  }

  startInstance = () => {
    const {
      activeTab
    } = this.state;

    this.startTab(activeTab);
  }

  // todo(pinussilvestrus): use this in the future to ensure deploying of current version
  async ensureDeployed(tab, forceDeploy = false) {

    const {
      log,
      displayNotification
    } = this.props;

    // (1) Get deployment details
    // (1.1) Try to get existing deployment details
    let details = await this.getSavedDeploymentDetails(tab);

    // (1.2) Open modal to enter deployment details
    if (!forceDeploy) {
      details = await this.getDeployDetailsFromUserInput(tab, details, {
        title: DeployStepTitle(),
        intro: DeployIntro(),
        primaryAction: 'Next'
      });

      // (1.2.1) Handle user cancelation
      if (!details) {
        return;
      }

      await this.saveDeployDetails(tab, details);
    }

    // (2) Trigger deployment
    // (2.1) Show deployment result (success or error
    try {
      const deployResult = await this.deployWithDetails(tab, details);

      // (3.2) save deployed process definition
      await this.saveProcessDefinition(tab, deployResult.deployedProcessDefinition);

      return details;
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

  }

  // todo(pinussilvestrus): refactor flags
  async startTab(tab, forceModal = false) {

    const {
      displayNotification,
      log
    } = this.props;

    tab = await this.saveTab();

    if (!tab) {
      return;
    }

    // (1) Get deployment details
    let processDefinition = await this.getSavedProcessDefinition(tab);

    // todo(pinussilvestrus): change with future checks
    const deploymentDetails = await this.ensureDeployed(tab, !!processDefinition);

    // todo(pinussilvestrus): this indicates user cancelation in the deploy step,
    // should not be needed here
    if (!deploymentDetails) {
      return;
    }

    processDefinition = await this.getSavedProcessDefinition(tab);

    // (2) Get start details
    let startDetails = await this.getSavedStartDetails(tab);

    const canStart = startDetails && this.canStartWithDetails(startDetails);

    if (!canStart || forceModal) {

      // (2.1) Open Modal to enter start details
      startDetails = await this.getStartDetailsFromUserInput(tab, startDetails);

      if (!startDetails) {
        return;
      }

      await this.saveStartDetails(tab, startDetails);
    }

    // todo(pinussilvestrus): what about 'auth' details
    startDetails = {
      ...startDetails,
      endpointUrl: deploymentDetails.endpointUrl
    };

    // (3) Trigger Start
    try {
      const processInstance = await this.startWithDetails(startDetails, processDefinition);

      this.showStartSuccessNotification(processInstance, startDetails);
    } catch (error) {
      displayNotification({
        type: 'error',
        title: 'Start Instance failed',
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

  // todo(pinussilvestrus): investigate better validation on when to run directly
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
          return resolve(this.getDetailsFromForm(result));
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

  validateDetails = values => {
    const validatedFields = this.getValidatedFields(values);

    const errors = validatedFields.reduce((currentErrors, field) => {
      const error = validators[field] && validators[field](values[field]);

      return error ? { ...currentErrors, [field]: error } : currentErrors;
    }, {});

    return errors;
  }

  checkConnection = async values => {
    const baseUrl = this.getBaseUrl(values.endpointUrl);
    const auth = this.getAuth(values);

    const api = new CamundaAPI(baseUrl);

    let connectionError = null;

    try {
      await api.checkConnection({ auth });
    } catch (error) {
      connectionError = error.message;
    }

    return connectionError;
  }

  getDetailsFromForm(values) {
    const payload = {
      businessKey: values.businessKey
    };

    return payload;
  }

  getAuth({ authType, username, password, bearer }) {
    switch (authType) {
    case AuthTypes.basic:
      return {
        username,
        password
      };
    case AuthTypes.bearer: {
      return {
        bearer
      };
    }
    }
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
      startModalState
    } = this.state;

    return <React.Fragment>

      <Fill slot="toolbar" group="8_deploy">
        <Button
          onClick={ this.startInstance }
          title="Start Current Diagram"
        >
          <Icon name="play" />
        </Button>
        <DropdownButton
          items={ () => this.START_ACTIONS.map(DropdownItem) }
        ></DropdownButton>
      </Fill>

      { startModalState &&
      <StartInstanceDetailsModal
        details={ startModalState.details }
        activeTab={ startModalState.tab }
        onClose={ startModalState.handleClose }
        onFocusChange={ this.handleFocusChange }
        validate={ this.validateDetails }
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
      className={ css.DropdownItem }
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
