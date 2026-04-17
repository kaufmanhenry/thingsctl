'use strict';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  collectCoverageFrom: ['src/lib/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
