/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import React from 'react';

import { Modal } from '../../app/primitives';

import css from './StartInstanceDetailsModal.less';

import {
  FormControl
} from './components';

import {
  Field,
  Form,
  Formik
} from 'formik';

const initialFormValues = {
  businessKey: 'default'
};

export default class StartInstanceDetailsModal extends React.PureComponent {

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  onClose = () => this.props.onClose();

  onSubmit = (values) => {
    this.props.onClose(values);
  }

  getInitialValues() {
    return { ...initialFormValues, ...this.props.details };
  }

  render() {
    const {
      onFocusChange
    } = this.props;

    const initialValues = this.getInitialValues();

    const onClose = this.onClose;
    const onSubmit = this.onSubmit;

    return (
      <Modal className={ css.StartInstanceDetailsModal } onClose={ onClose }>
        <Formik
          initialValues={ initialValues }
          onSubmit={ onSubmit }
        >
          {({ isSubmitting }) => (
            <Form>
              <Modal.Title>
                  Start Process Instance <b>Step 2/2</b>
              </Modal.Title>

              <Modal.Body>

                <p className="intro">
                  Enter details to start the process on the <a href="https://docs.camunda.org/manual/latest/reference/rest/process-definition/post-start-process-instance/">Camunda Engine</a>.
                </p>

                <div className="deploy-success">
                    Deployed successfully.
                </div>

                <fieldset>

                  <legend>
                    Details
                  </legend>

                  <div className="fields">
                    <Field
                      name="businessKey"
                      component={ FormControl }
                      label="Business Key"
                      validated
                      autoFocus
                      onFocusChange={ onFocusChange }
                    />
                  </div>
                </fieldset>
              </Modal.Body>
              <Modal.Footer>

                <div className="form-submit">

                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={ onClose }
                  >
                  Cancel
                  </button>

                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={ isSubmitting }>
                  Start
                  </button>
                </div>
              </Modal.Footer>
            </Form>
          )}
        </Formik>
      </Modal>
    );
  }
}