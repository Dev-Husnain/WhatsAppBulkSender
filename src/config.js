require('dotenv').config({ quiet: true });

const config = {
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '92',
  defaultMessage: process.env.DEFAULT_MESSAGE || 'Hello {name}!',
  minDelay: Number(process.env.MIN_DELAY || 5),
  maxDelay: Number(process.env.MAX_DELAY || 15),
  contactsFile: process.env.CONTACTS_FILE || 'contacts.csv',
  resultsFile: process.env.RESULTS_FILE || 'results.csv',
};

if (config.minDelay > config.maxDelay) {
  throw new Error('MIN_DELAY must not be greater than MAX_DELAY');
}

module.exports = config;
