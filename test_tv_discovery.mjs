#!/usr/bin/env node

import { discoverAndValidateTVs } from './packages/server/dist/utils/tvValidator.js';
import { scanForTVDevices } from './packages/server/dist/utils/networkDiscovery.js';

console.log('🔍 Testing TV Discovery System...\n');

async function testTVDiscovery() {
  try {
    console.log('1. Scanning network for TV candidates...');
    const candidates = await scanForTVDevices();

    console.log(`   Found ${candidates.length} TV candidates:`);
    candidates.forEach((candidate, index) => {
      console.log(
        `   ${index + 1}. ${candidate.ip} (${candidate.hostname || 'unknown'}) - confidence: ${candidate.confidence.toFixed(2)} - ${candidate.reason}`
      );
      if (candidate.brand) {
        console.log(`      Brand: ${candidate.brand}`);
      }
    });

    if (candidates.length === 0) {
      console.log('   No TV candidates found on network');
      return;
    }

    console.log('\n2. Validating TV candidates...');
    const validTVs = await discoverAndValidateTVs();

    console.log(`   Found ${validTVs.length} valid TVs:`);
    validTVs.forEach((tv, index) => {
      console.log(`   ${index + 1}. ${tv.ip}:${tv.port}`);
      console.log(`      Response time: ${tv.responseTime}ms`);
      console.log(`      Auth required: ${tv.authRequired ? 'Yes' : 'No'}`);
      if (tv.deviceInfo?.name) {
        console.log(`      Device name: ${tv.deviceInfo.name}`);
      }
      if (tv.deviceInfo?.brand) {
        console.log(`      Brand: ${tv.deviceInfo.brand}`);
      }
    });

    if (validTVs.length > 0) {
      console.log('\n✅ TV discovery system working correctly!');
      console.log(
        `   Best candidate: ${validTVs[0].ip}:${validTVs[0].port} (${validTVs[0].responseTime}ms)`
      );
    } else {
      console.log('\n⚠️  No valid TVs found during validation');
    }
  } catch (error) {
    console.error('\n❌ TV discovery test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testTVDiscovery();
