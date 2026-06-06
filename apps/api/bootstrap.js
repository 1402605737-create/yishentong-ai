const { Bootstrap } = require('@midwayjs/bootstrap');

process.env.MIDWAY_SERVER_ENV = process.env.MIDWAY_SERVER_ENV || 'local';
process.env.NODE_ENV = process.env.NODE_ENV || 'local';

Bootstrap.run();
