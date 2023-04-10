## StEver cluster upgrade guide
1. Set `StEverVault` to the paused state via method `setIsPaused(true)` value=2
2. Build contracts `npx locklift build`

3. Upgrade `StEverVault`
   - Get new code `npx locklift code -c StEverVault`
   - Run upgrade `StEverVault.upgrade(newCode, newVersion=4, _sendGasTo)` value=2
4. Upgrade `StEverCluster`
   - Get new code `npx locklift code -c StEverCluster`
   - Set new cluster code `StEverVault.setNewClusterCode(newCode)` value=2
   - Upgrade `StEverVault.upgradeStEverClusters(_sendGasTo=admin, _clusters=["0:cedb787c499417abeb88c965594b849485c940dae20035c8279e37a291a361fd","0:86ea048f599734f266d3267a66941cd218dfb8120e4eca8cc055fdba8413fade"])` value=2
5. Fixing
   - Call method `StEverVault.setStrategiesTotalAssets(_totalAssetsConfig=[{strategy:"0:b610d0fa3ae6850a8b17caf5b9dda587d9833c3bd31bf2c599c3ab7af3c89507",totalAssets: "0"}])` value=5
   - Call method `StEverVault.forceStrategyRemove(_strategy="0:0fb3e96f08434570cdf9e06c6bd69875b844fbca3363561464020631e910e379", _cluster="0:86ea048f599734f266d3267a66941cd218dfb8120e4eca8cc055fdba8413fade")` value=3
6. Set `StEverVault` to the active state via method `setIsPaused(false)` value=2
