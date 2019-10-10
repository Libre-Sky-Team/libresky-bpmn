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

import { omit } from 'min-dash';

import AuthTypes from './AuthTypes';
import CamundaAPI from './CamundaAPI';
import DeploymentDetailsModal from './DeploymentDetailsModal';
import getEditMenu from './getEditMenu';
import validators from './validators';

import { Fill } from '../../app/slot-fill';

import {
  Button,
  Icon
} from '../../app/primitives';

const VALIDATED_FIELDS = [
  'deploymentName',
  'endpointUrl'
];

const CONFIG_KEY = 'deployment-tool';

const defaultDeploymentDetails = {
  endpointUrl: 'http://localhost:8080/engine-rest',
  tenantId: '',
  authType: AuthTypes.none,
  username: '',
  password: '',
  bearer: '',
  rememberCredentials: false
};

export default class DeploymentTool extends PureComponent {

  state = {
    modalState: null,
    activeTab: null
  }

  componentDidMount() {
    this.props.subscribe('app.activeTabChanged', activeTab => {
      this.setState({ activeTab });
    });
  }

  saveTab() {
    const {
      triggerAction
    } = this.props;

    return triggerAction('save');
  }

  deploy = () => {
    const {
      activeTab
    } = this.state;

    return this.deployTab(activeTab);
  }

  async deployTab(tab) {

    // (1.2) Open save file dialog if dirty
    tab = await this.saveTab();

    // (1.3) Cancel deploy if file save cancelled
    if (!tab) {
      return;
    }

    // (2) Get deployment details
    // (2.1) Try to get existing deployment details
    let details = await this.getSavedDetails(tab);

    // (2.2) Check if details are complete
    const canDeploy = this.canDeployWithDetails(details);

    if (!canDeploy) {

      // (2.3) Open modal to enter deployment details
      details = await this.getDetailsFromUserInput(tab, details);

      // (2.3.1) Handle user cancelation
      if (!details) {
        return;
      }

      await this.saveDetails(tab, details);
    }

    // (3) Trigger deployment
    // (3.1) Show deployment result (success or error)
    const {
      log,
      displayNotification
    } = this.props;

    const payload = this.getDeploymentPayload(details);

    try {
      await this.deployWithDetails(tab, payload);

      displayNotification({
        type: 'success',
        title: 'Deployment succeeded',
        duration: 4000
      });
    } catch (error) {
      displayNotification({
        type: 'error',
        title: 'Deployment failed',
        content: 'See the log for further details.',
        duration: 10000
      });
      log({ category: 'deploy-error', message: error.problems || error.message });
    }
  }

  saveDetails(tab, details) {
    return Promise.all([
      this.saveDeploymentDetails(tab, details),
      this.saveAuthDetails(details)
    ]);
  }

  saveDeploymentDetails(tab, details) {
    const {
      config
    } = this.props;

    const detailsForFile = this.getDetailsToSave(details);

    return config.setForFile(tab.file, CONFIG_KEY, detailsForFile);
  }

  saveAuthDetails(details) {
    const {
      config
    } = this.props;

    // skip saving if user did not opt in
    if (!details.rememberCredentials) {
      return;
    }

    const accountName = this.getAccountName(details);

    // skip saving if can't determine account name
    if (!accountName) {
      return;
    }

    const auth = this.getAuth(details);
    const authWithoutUsername = omit(auth, 'username');

    return config.setCredentials(CONFIG_KEY, accountName, authWithoutUsername);
  }

  async getSavedDetails(tab) {
    const {
      config
    } = this.props;

    const detailsForFile = await config.getForFile(tab.file, CONFIG_KEY);

    const auth = await this.getSavedAuthDetails(detailsForFile);

    return {
      ...detailsForFile,
      ...auth
    };
  }

  getSavedAuthDetails(deploymentConfig) {
    const {
      config
    } = this.props;

    const accountName = this.getAccountName(deploymentConfig);

    if (accountName) {
      return config.getCredentials(CONFIG_KEY, accountName);
    }
  }

  getAccountName(config) {
    if (!config) {
      return null;
    }

    const {
      authType,
      endpointUrl,
      username
    } = config;

    if (!endpointUrl || !authType || authType === AuthTypes.none) {
      return null;
    }

    return authType === AuthTypes.basic ?
      `${authType}.${username}.${endpointUrl}` :
      `${authType}.${endpointUrl}`;
  }

  deployWithDetails(tab, details) {

    const payload = this.getDeploymentPayload(details);

    const api = new CamundaAPI(payload.endpointUrl);

    return api.deployDiagram(tab.file, payload);
  }

  canDeployWithDetails(details) {

    // TODO(barmac): implement for instant deployment
    return false;
  }

  getDetailsFromUserInput(tab, details) {
    const initialDetails = this.getInitialDetails(tab, details);

    return new Promise(resolve => {
      const handleClose = result => {

        this.setState({
          modalState: null
        });

        this.updateMenu();

        // contract: if details provided, user closed with O.K.
        // otherwise they canceled it
        return resolve(result);
      };

      this.setState({
        modalState: {
          tab,
          details: initialDetails,
          handleClose
        }
      });
    });
  }

  getDetailsToSave(rawDetails) {
    return omit(rawDetails, [ 'bearer', 'password' ]);
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

  getInitialDetails(tab, providedDetails) {
    const details = { ...defaultDeploymentDetails, ...providedDetails };

    if (!details.deploymentName) {
      details.deploymentName = withoutExtension(tab.name);
    }

    return details;
  }

  getValidatedFields(values) {
    switch (values.authType) {
    case AuthTypes.none:
      return VALIDATED_FIELDS;
    case AuthTypes.bearer:
      return VALIDATED_FIELDS.concat('bearer');
    case AuthTypes.basic:
      return VALIDATED_FIELDS.concat('username', 'password');
    }
  }

  getDeploymentPayload(values) {
    const endpointUrl = this.getBaseUrl(values.endpointUrl);

    const payload = {
      endpointUrl,
      deploymentName: values.deploymentName,
      tenantId: values.tenantId,
      authType: values.authType
    };

    const auth = this.getAuth(values);

    if (auth) {
      payload.auth = auth;
    }

    return payload;
  }

  /**
   * Extract base url in case `/deployment/create` was added at the end.
   * @param {string} url
   */
  getBaseUrl(url) {
    return url.replace(/\/deployment\/create\/?/, '');
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
      modalState
    } = this.state;

    return <React.Fragment>
      <Fill slot="toolbar" group="8_deploy">
        <Button
          onClick={ this.deploy }
          title="Deploy Current Diagram"
        >
          <Icon name="deploy" />
        </Button>
      </Fill>

      { modalState &&
        <DeploymentDetailsModal
          details={ modalState.details }
          activeTab={ modalState.tab }
          onClose={ modalState.handleClose }
          onFocusChange={ this.handleFocusChange }
          validate={ this.validateDetails }
          checkConnection={ this.checkConnection }
        /> }
    </React.Fragment>;
  }

}



// helpers //////////
function isFocusedOnInput(event) {
  return event.type === 'focus' && ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
}

function withoutExtension(name) {
  return name.replace(/\.[^.]+$/, '');
}
