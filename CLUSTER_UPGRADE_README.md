## StEver cluster upgrade guide
1. Set `StEverVault` to the paused state via method `setIsPaused(true)` value=2
2. Build contracts `npx locklift build`

3. Upgrade `StEverVault`
   - Get new code `npx locklift code -c StEverVault`
   - Run upgrade `StEverVault.upgrade(newCode, newVersion=5, _sendGasTo)` value=2
4. Upgrade accounts
   - Get new code `npx locklift code -c StEverAccount`
   - Set new code for accounts `StEverVault.setNewAccountCode(newCode)` value=2
   - Run upgrade `StEverVault.upgradeStEverAccounts(_sendGasTo, _users=address[])` value=2*usersCount
5. Upgrade `StEverCluster`
   - Get new code `npx locklift code -c StEverCluster`
   - Set new cluster code `StEverVault.setNewClusterCode(newCode)` value=2
   - Upgrade `StEverVault.upgradeStEverClusters(_sendGasTo=admin, _clusters=["0:cedb787c499417abeb88c965594b849485c940dae20035c8279e37a291a361fd","0:86ea048f599734f266d3267a66941cd218dfb8120e4eca8cc055fdba8413fade"])` value=2
6. Set `StEverVault` to the active state via method `setIsPaused(false)` value=2
