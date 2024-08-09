import { Subject } from 'rxjs';
const { newFrontendClient } = require('@notifi-network/notifi-frontend-client');
import { signMessageForNotifi } from '../utils/blockchain';
import config from '../config';

export default class notifiService {
  notifi$ = new Subject();
  currentScreen$ = new Subject();
  loadHistory$ = new Subject();
  alertSettingsUpdated$ = new Subject();
  alertSettings = {};

  emitNotifi(notifi) {
    this.notifi$.next(notifi);
  }

  observeNotifi() {
    return this.notifi$.asObservable();
  }

  emitCurrentScreen() {
    this.currentScreen$.next(null);
  }

  observeCurrentScreen() {
    return this.currentScreen$.asObservable();
  }

  emitLoadHistory(history) {
    this.loadHistory$.next(history);
  }

  observeLoadHistory() {
    return this.loadHistory$.asObservable();
  }

  emitAlertSettingsUpdated() {
    this.alertSettingsUpdated$.next(null);
  }

  observeAlertSettingsUpdated() {
    return this.alertSettingsUpdated$.asObservable();
  }

  // we call this only once to set up notifi client
  async setupNotifi(account, alertsConfig) {

    const walletBlockchain = window.chain.toUpperCase();
    const walletPublicKey = account;
    const tenantId = 'deltaprime';
    const blockchainEnv = 'Production';

    const newFrontendConfig = {
      account: {
        publicKey: walletPublicKey
      },
      walletBlockchain,
      tenantId,
      env: blockchainEnv
    };

    const client = newFrontendClient(newFrontendConfig);
    const notifi = await this.refreshClientInfo(client);

    // alerts states for setting screen
    this.alertSettings = alertsConfig;

    if (notifi.alerts) {
      for (const alert of notifi.alerts) {
        // get alerts statuses for initialization on settings screen
        let fusionEvent;

        fusionEvent = Object.entries(config.fusionEventIds).find(([name, eventId]) => eventId == alert.sourceGroup.sources[0].fusionEventTypeId); // TODO: use alert.name instead

        if (this.alertSettings[fusionEvent[0]]) {
          this.alertSettings[fusionEvent[0]]['created'] = true;

          if (fusionEvent[0] === 'borrowRate' || fusionEvent[0] === 'lendingRate') {
            // we can have multiple borrow rate alerts with differnt thresholds
            if (!this.alertSettings[fusionEvent[0]]['filterOptions']) this.alertSettings[fusionEvent[0]]['filterOptions'] = [];
            this.alertSettings[fusionEvent[0]]['filterOptions'].push({
              ...JSON.parse(alert.filterOptions),
              poolAddress: alert.sourceGroup.sources[0].blockchainAddress,
              id: alert.id
            });
          } else {
            this.alertSettings[fusionEvent[0]]['id'] = alert.id;
            this.alertSettings[fusionEvent[0]]['filterOptions'] = JSON.parse(alert.filterOptions);
          }
        }
      }
    }

    this.emitAlertSettingsUpdated();
  }

  async refreshClientInfo(client) {
    // check if user already authenticated by notifi
    const initRes = await client.initialize();
    const authenticated = initRes.status === 'authenticated';
    let data = {};
    let history = {};

    if (authenticated) {
      // get user's targets and alerts configured
      data = await client.fetchData(); // TODO: change to fetchFusionData
      history = await this.getNotifications(client);
    }

    const notifi = {
      client,
      authenticated,
      targetGroups: data.targetGroup,
      alerts: data.alert,
      history
    };

    this.emitNotifi(notifi);
    return notifi;
  }

  async login(client, provider, account) {
    const loginResult = await client.logIn({
      walletBlockchain: window.chain.toUpperCase(),
      signMessage: async (message) => {
        const { signedMessage } = await signMessageForNotifi(
          provider,
          message,
          account
        );

        return signedMessage;
      },
    });

    // client should be authenticated now
  }

  async createTargetGroups(client, targetPayload) {
    const targetGroups = await client.ensureTargetGroup(targetPayload);

    return targetGroups;
  }

  async handleCreateAlert(alert, payload) {
    this.alertSettings[alert.alertType]['created'] = alert.toggle;

    if (!alert.toggle) {
      if (alert.alertType === 'borrowRate' || alert.alertType === 'lendingRate') {
        this.alertSettings[alert.alertType]['filterOptions'] =
          this.alertSettings[alert.alertType]['filterOptions'].filter((option) => option.id != alert.alertId);
      }
      this.deleteAlert(payload.client, alert.alertId);
    } else {
      const alertRes = await this[this.alertSettings[alert.alertType].createMethod](payload);
      const createdAlert = alertRes.alerts[0];
      if (!createdAlert) return;
      // if (!alertRes.id) return;

      // update alerts states for settings screen
      if (alert.alertType === 'borrowRate' || alert.alertType === 'lendingRate') {
        if (!this.alertSettings[alert.alertType]['filterOptions']) this.alertSettings[alert.alertType]['filterOptions'] = [];
        this.alertSettings[alert.alertType]['filterOptions'].push({
          ...JSON.parse(createdAlert.filterOptions),
          poolAddress: payload.poolAddress,
          id: createdAlert.id
        });
      } else {
        this.alertSettings[alert.alertType]['id'] = createdAlert.id;
        this.alertSettings[alert.alertType]['filterOptions'] = JSON.parse(createdAlert.filterOptions);
      }
    }

    this.emitAlertSettingsUpdated();
  }

  async createAnnouncements({ client, targetGroupId, alertType }) {
    const result = await client.ensureFusionAlerts({
      alerts: [
        {
          filterOptions: JSON.stringify({
            version: 1,
            input: {},
          }),
          fusionEventId: config.fusionEventIds[alertType],
          name: config.fusionEventIds[alertType],
          subscriptionValue: "*",
          targetGroupId,
        },
      ],
    });
    return result;
  }

  /*
  alertFrequency options
  - ALWAYS
  - SINGLE
  - QUARTER_HOUR
  - HOURLY
  - DAILY
  */

  async createLiquidationAlerts({ client, walletAddress, network, targetGroupId, alertType }) {
  
    const result = await client.ensureFusionAlerts({
      alerts: [
        {
          filterOptions: JSON.stringify({
            version: 1,
            input: {},
          }),
          fusionEventId: config.fusionEventIds[alertType],
          name: config.fusionEventIds[alertType],
          subscriptionValue: walletAddress,
          targetGroupId,
        },
      ],
    });
  
    return result;
  }

  async createLoanHealthAlerts({ client, walletAddress, healthRatio, network, targetGroupId }) {
    const result = await client.ensureFusionAlerts({
      alerts: [
        {
          filterOptions: JSON.stringify({
            version: 1,
            input: {
              belowThreshold: {
                thresholdDirection: "below",
                threshold: healthRatio, // TODO: Double confirm if 0.1 or 10
              },
            },
          }),
          fusionEventId: config.fusionEventIds.loanHealth,
          name: config.fusionEventIds.loanHealth,
          subscriptionValue: walletAddress,
          targetGroupId,
        },
      ],
    });
  
    return result;
  }

  async createBorrowRateAlerts({ client, poolAddress, thresholdDirection, threshold, network, targetGroupId }) {
    const result = await client.ensureFusionAlerts({
      alerts: [
        {
          filterOptions: JSON.stringify({
            version: 1,
            input: {
              aboveOrBelowThreshold: {
                thresholdDirection,
                threshold,
              },
            },
          }),
          fusionEventId: config.fusionEventIds.borrowRate,
          // NOTE: to avoid duplicate name, the name of alert needs to be unique. <fusionEventId>:;:<subscriptionValue>:;:<thresholdDirection>:;:<threshold>
          name: `${config.fusionEventIds.borrowRate}:;:${poolAddress.toLowerCase()}:;:${thresholdDirection}:;:${threshold}`,
          subscriptionValue: poolAddress,
          targetGroupId,
        },
      ],
    });

    return result;
  }

  async createLendingRateAlerts({ client, poolAddress, thresholdDirection, threshold, network, targetGroupId }) {
    const result = await client.ensureFusionAlerts({
      alerts: [
        {
          filterOptions: JSON.stringify({
            version: 1,
            input: {
              aboveOrBelowThreshold: {
                thresholdDirection,
                threshold,
              },
            },
          }),
          fusionEventId: config.fusionEventIds.lendingRate,
          name: config.fusionEventIds.lendingRate,
          // NOTE: to avoid duplicate name, the name of alert needs to be unique. <fusionEventId>:;:<subscriptionValue>:;:<thresholdDirection>:;:<threshold>
          name: `${config.fusionEventIds.lendingRate}:;:${poolAddress.toLowerCase()}:;:${thresholdDirection}:;:${threshold}`,
          subscriptionValue: poolAddress,
          targetGroupId,
        },
      ],
    });

    return result;
  }

  async getNotifications(client, after, first = 20) {
    const history = await client.getNotificationHistory({
      after,
      first
    });

    return history;
  }

  async sendEmailTargetVerification(client, targetId) {
    const id = await client.sendEmailTargetVerification({ targetId });
    return id;
  }

  async deleteAlert(client, alertId) {
    await client.deleteAlert({ id: alertId });
  }
}