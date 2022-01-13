//
// github-awesomer
//
// Copyright © 2020 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Shelly Xue Han on 2020-06-04.
//

'use strict';

import dotenv from 'dotenv';
import config from './config';
import { verifyAuth } from './utils/github';
import { notifyInactiveUsers } from './inactiveUsers';

dotenv.config();

// Main:
(async () => {
  const inputFile = './invite_users.txt';
  const outputFile = './output/inactive_users.json';

  try {
    await verifyAuth(config.get('github:owner'));

    // Fetch inactive users for 6 months:
    await notifyInactiveUsers('bcgov-c', 6, outputFile);
  } catch (err) {
    console.error(err);
  }
})();
