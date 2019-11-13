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

import {
  Modal
} from '../../primitives';

import css from './View.less';

import {
  PRIVACY_TEXT_FIELD,
  PRIVACY_POLICY_URL,
  LEARN_MORE_TEXT,
  PRIVACY_POLICY_TEXT,
  PREFERENCES_LIST,
  OK_BUTTON_TEXT,
  TITLE
} from './constants';

class View extends PureComponent {
  constructor(props) {
    super(props);

    this.privacyPreferences = props.privacyPreferences || {
      ENABLE_CRASH_REPORTS: true,
      ENABLE_USAGE_STATISTICS: true,
      ENABLE_UPDATE_CHECKS: true
    };
  }

  setPreference(key, value) {
    this.privacyPreferences[key] = value;
    this.props.setPrivacyPreferences(this.privacyPreferences);
  }

  renderPreferences() {
    return PREFERENCES_LIST.map((item) => (
      <div key={ item.key } className='grid-container'>
        <div className='grid-item item1'>
          <input
            type="checkbox"
            defaultChecked={ this.privacyPreferences[item.key] }
            onChange={ (event) => {
              const isChecked = event.target.checked;
              this.setPreference(item.key, isChecked);
            } } />
        </div>
        <div className='grid-item item2'>
          <div className="checkboxLabel"> { item.title } </div>
          <div className="checkboxExplanation"> { item.explanation } </div>
        </div>
      </div>
    ));
  }

  render() {
    const {
      onClose
    } = this.props;

    return (
      <Modal className={ css.View } onClose={ onClose }>

        <Modal.Title>{ TITLE }</Modal.Title>

        <Modal.Body>
          <div className="privacyTextField">
            <p>
              { PRIVACY_TEXT_FIELD }
            </p>
          </div>

          <div className="privacyPreferencesField">
            { this.renderPreferences() }
          </div>
          <div className="privacyMoreInfoField">
            <p>
              { LEARN_MORE_TEXT }
              <a href={ PRIVACY_POLICY_URL }>
                { PRIVACY_POLICY_TEXT }
              </a>
            </p>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="form-submit">
            <button type="submit" onClick={ () => {
              onClose();
            } }>
              { OK_BUTTON_TEXT }
            </button>
          </div>
        </Modal.Footer>

      </Modal>
    );
  }
}

export default View;
