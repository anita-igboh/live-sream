/* eslint-disable no-unused-vars */
/* eslint-disable function-paren-newline */
/* eslint-disable implicit-arrow-linebreak */
import morgan from 'morgan';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import routes from '../routes/v1';

const expressConfig = (app) => {
  const env = app.get('env');

  logger.info('App is starting...');
  logger.info(`Environment is ${env}`);

  app.use(morgan('combined', { stream: logger.stream }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(helmet());
  app.disable('x-powered-by');
  app.use(cors());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS, PUT, PATCH, DELETE',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Origin, Content-Type, Accept',
    );
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
  });

  app.use('/api/v1', routes);

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    const err = new Error('Route Not Found');
    err.status = 404;
    next(err);
  });
  // error handlers

  // development error handler
  // will print stacktrace
  if (app.get('env') === 'development' || app.get('env') === 'test') {
    app.use((err, req, res, next) =>
      res.status(err.code || 500).json({
        status: err.status,
        code: err.code,
        message: err.message,
        data: err.data,
      }),
    );
  }

  // production error handler
  // remove stacktrace
  app.use((err, req, res, next) =>
    res.status(err.code || 500).json({ message: err.message }),
  );
};

export default expressConfig;
