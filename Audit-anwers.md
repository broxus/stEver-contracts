## Review notes remarks (p. 7)
The deposit flow is working slightly differently from it described in the document.
`After each validator round, the DePool
transfers the rewards to the vault through the Strategy contracts.` this is not true,
because after each round strategies are receiving information about the past round without any rewards

## FINDINGS

### CON-01
#### Overview
`According to the current implementation of processEmergencyWithdrawFromStrategy() , the vault will withdraw all assets
from its strategies and send the asset to the emergency state emitter` this isn't true.
Because the emergency emitter will receive only the remaining tokens after emitting the withdrawal process from strategies

#### Scenario
The described scenario is fine, except for the last step
`In the current implementation, onStrategyHandleWithdrawRequest will transfer all of the withdrawal amounts to the
emergency state emitter which is the external account A. See L318-L322.`
Method `onStrategyHandleWithdrawRequest` doesn't receive funds, except for `remaining gas` that was attached by the emergency emitter.
All funds from the strategies vault handle only by these methods:
- `receiveFromStrategy`
- `receiveAdditionalTransferFromStrategy`

### GLOBAL-01
#### Overview
We are using our `multisig` wallet with 2+ signers

### SDP-01
#### Overview
- `StEverTokenRoot` - https://github.com/broxus/tip3/blob/master/contracts/TokenRoot.tsol
- `DePool` - https://github.com/broxus/stEver-depool-contracts/blob/master/DePool.tsol
- `DePoolProxy` - https://github.com/broxus/stEver-depool-contracts/blob/master/DePoolProxy.tsol

### SEA-01
#### Overview
For the `account` or `(Program derived accounts)` we are using a special contract called [Platform](https://github.com/broxus/ever-contracts/blob/master/contracts/platform/Platform.tsol).
This contract wraps the original contract in our case this is `StEverAccount` and call method [onCodeUpgrade](https://github.com/broxus/ever-contracts/blob/master/contracts/platform/Platform.tsol#L45)
instead of the contract constructor, so this method is used for both upgrade and deploy. In this case, `onCodeUpgrade` was used only for deploy, not for an upgrade.

### SDP-02
#### Overview
This issue is accepted, we will add an additional `if` condition for dividing error handling between deposits and withdrawals

### SEV-01
#### Overview
The behavior of these methods doesn't break our rules, the infinity limit for `setGainFee()` is our rule.
And `setStEverFeePercent()` can be up to 100%

### SEE-01
#### Overview
Each user with proof of long-term withdrawal request can be an emitter of an emergency state. The user calls the method `startEmergencyProcess` with the proof nonce.
Then we are going to check if this nonce exists and if this withdraw request is leaving more than `uint64 constant TIME_AFTER_EMERGENCY_CAN_BE_ACTIVATED = 168 hours`
If these conditions are passed, the user absolutely can be an emergency emitter.

### SEV-02
#### Overview
Tvm messages can't consume more than 1 ever as the gas value, so if we need to consume more gas we need to call `self` as the external contract `this.slefCall()`.


