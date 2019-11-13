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

import DeploymentTool from './DeploymentTool';

import StartInstanceTool from './StartInstanceTool';

// todo(pinussilvestrus): layer for handling both deployment and start tool
export default class CamundaPlugin extends PureComponent {

    deployRef = React.createRef();
    startInstanceRef = React.createRef();

    render() {

      return <React.Fragment>
        <DeploymentTool
          ref={ this.deployRef }
          startInstanceRef={ this.startInstanceRef }
          { ...this.props } />

        <StartInstanceTool
          ref={ this.startInstanceRef }
          deployRef={ this.deployRef }
          { ...this.props } />
      </React.Fragment>;
    }
}