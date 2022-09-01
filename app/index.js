/* eslint-disable no-undef */
import express from 'express';
import https from 'httpolyglot';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import config, { initConfig } from './config';
import db from './db';
import Logger from './config/logger';

const mediasoup = require('mediasoup');

console.log(mediasoup, 'mediasoup');
const dirname = path.resolve();

const app = express();
const host = config.HOST;
const port = config.PORT || 3033;
const apiVersion = config.API_VERSION || 'v1';

const logger = Logger.createLogger({ label: 'TEMPLATE' });
global.logger = logger;

initConfig(app);

const options = {
  key: fs.readFileSync(`${dirname}/app/server/ssl/key.pem`, 'utf-8'),
  cert: fs.readFileSync(`${dirname}/app/server/ssl/cert.pem`, 'utf-8'),
};
const server = https.createServer(options, app);

const io = new Server(server);

const peers = io.of('/mediasoup');

let worker;
let router;
let producerTransport;
let consumerTransport;
let producer;
let consumer;

const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  });
  console.log(`worker pid ${worker.pid}`);
  worker.on('died', (error) => {
    console.error('mediasoup worker has died');
    setTimeout(() => process.exit(1), 2000); // exit in 2 seconds
  });

  return worker;
};

worker = createWorker();

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },

  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

const createWebRtcTransport = async (callback) => {
  try {
    const webRtcTransport_options = {
      listenIps: [
        {
          ip: '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };
    const transport = await router.createWebRtcTransport(webRtcTransport_options);
    console.log(`transport id': ${transport.id}`);
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('close', () => {
      console.log('transport closed');
    });

    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });

    return transport;
  } catch (error) {
    console.log(error);
    callback({
      params: {
        error,
      },
    });
  }
};

peers.on('connection', async (socket) => {
  console.log(socket.id, 'socket ID');
  socket.emit('connection-success', { socketId: socket.id });

  socket.on('disconnect', () => {
    console.log('peer disconnected');
  });
  router = await worker.createRouter({ mediaCodecs });

  socket.on('getRtpCapabilities', (callback) => {
    const { rtpCapabilities } = router;
    console.log('rtp Capabilities', rtpCapabilities);

    callback({ rtpCapabilities });
  });

  socket.on('createWebRtcTransport', async ({ sender }, callback) => {
    console.log(`Is this a sender request? ${sender}`);
    if (sender) {
      producerTransport = await createWebRtcTransport(callback);
    } else {
      consumerTransport = await createWebRtcTransport(callback);
    }
  });

  socket.on('transport-connect', async ({ dtlsParameters }) => {
    console.log('DTLS PARAMS...', { dtlsParameters });
    await producerTransport.connect({ dtlsParameters });
  });

  socket.on('transport-produce', async ({ kind, rtpParameters }, callback) => {
    producer = await producerTransport.produce({
      kind,
      rtpParameters,
    });

    console.log('Producer ID: ', producer.id, producer.kind);

    producer.on('transportclose', () => {
      console.log('transport for this producer closed');
      producer.close();
    });

    callback({
      id: producer.id,
    });
  });

  socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
    console.log(`DTLS PARAMS: ${dtlsParameters}`);
    await consumerTransport.connect({ dtlsParameters });
  });

  socket.on('consume', async ({ rtpCapabilities }, callback) => {
    try {
      console.log('rtpCapabilities in consumer', rtpCapabilities);
      if (router.canConsume({
        producerId: producer.id,
        rtpCapabilities,
      })) {
        consumer = await consumerTransport.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: true,
        });

        consumer.on('transportclose', () => {
          console.log('transport close from consumer');
        });

        consumer.on('producerclose', () => {
          console.log('producer of consumer closed');
        });

        const params = {
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        };
        callback({ params });
      }
    } catch (error) {
      console.log(error.message);
      callback({
        params: {
          error,
        },
      });
    }
  });

  socket.on('consumer-resume', async () => {
    console.log('consumer resume');
    await consumer.resume();
  });
});

db.connect()
  .then((operation) => {
    server.listen(port, () => {
      operation.done();
      logger.info(`Server started at ${host}:${port}/api/${apiVersion}/`);
    });
  })
  .catch((error) => {
    console.log(error.message);
    logger.error(error.message);
  });

export default app;
