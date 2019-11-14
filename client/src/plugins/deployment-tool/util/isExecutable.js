/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import BpmnModdle from 'bpmn-moddle';

import camundaModdle from 'camunda-bpmn-moddle/resources/camunda';

import {
  find
} from 'min-dash';

async function fromXML(diagram) {
  return new Promise((resolve, reject) => {

    const {
      contents
    } = diagram;

    const Moddle = new BpmnModdle({ camunda: camundaModdle });

    Moddle.fromXML(contents, function(err, definitions) {

      if (err) {
        reject(err);
      }

      resolve(definitions);

    });
  });
}

export default async function isExecutable(diagram) {

  const definitions = await fromXML(diagram);

  const rootElements = definitions.get('rootElements');

  return rootElements && find(rootElements, element => element.isExecutable);
}