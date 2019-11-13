/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

const StartErrorMessages = {
  noInternetConnection: 'Could not establish a network connection. Most likely your machine is not online right now.',
  unableToConnect: 'Could not connect to the server. Did you run the engine?',
  startError: 'Server could not run the diagram. Please check log for errors.',
  unauthorized: 'The execution was unauthorized. Please use valid credentials.',
  forbidden: 'The execution was not permitted for your credentials. Please check your credentials.',
  notFound: 'Could not connect to Camunda. Please check the endpoint URL.',
  internalServerError: 'Camunda reported an unknown error. Please check the server status.',
  serverUnavailable: 'Camunda is currently unavailable. Please try again later.'
};

const RUN_ERROR = 'Cannot instantiate process definition';

export default class StartInstanceError extends Error {
  constructor(response, body) {
    super();

    this.message = (
      this.getCamundaBpmErrorMessage(body) ||
        this.getStatusCodeErrorMessage(response) ||
        this.getNetworkErrorMessage(response)
    );

    this.problems = this.getProblems(body);
  }

  getCamundaBpmErrorMessage(body) {
    if (body && body.message && body.message.startsWith(RUN_ERROR)) {
      return StartErrorMessages.startError;
    }
  }

  getStatusCodeErrorMessage(response) {
    switch (response.status) {
    case 401:
      return StartErrorMessages.unauthorized;
    case 403:
      return StartErrorMessages.forbidden;
    case 404:
      return StartErrorMessages.notFound;
    case 500:
      return StartErrorMessages.internalServerError;
    case 503:
      return StartErrorMessages.serverUnavailable;
    }
  }

  getNetworkErrorMessage(response) {
    if (!/^https?:\/\/localhost/.test(response.url) && !window.navigator.onLine) {
      return StartErrorMessages.noInternetConnection;
    }

    return StartErrorMessages.unableToConnect;
  }

  getProblems(body) {
    return body.message;
  }
}
