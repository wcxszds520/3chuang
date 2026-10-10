'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const demoTemplates = require('../config/demo-cargo-templates');
const { CONTAINERS } = require('./solverBenchmarkCases');

async function buildProjectBenchmarkCases() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../web-dashboard/src/domain/cargo/initialDataset.js')).href;
  const datasetModule = await import(moduleUrl);
  const datasetA = datasetModule.createInitialCargo().map((cargo) => ({ ...cargo, dataClassification: 'DEMO_DATA' }));
  const datasetB = demoTemplates.mixedCargo.cargoList.map((cargo, index) => ({
    ...cargo,
    cargoId: cargo.cargoId || `DATASET-B-${index + 1}`,
    sku: cargo.sku || `DATASET-B-SKU-${index + 1}`,
    packagingType: cargo.packagingType || (cargo.fragile ? 'protected' : 'generic'),
    handlingMethod: cargo.handlingMethod || (Number(cargo.weight || 0) >= 20 ? 'forklift' : 'manual'),
    dataClassification: 'DEMO_DATA'
  }));
  return [
    {
      id: 'DATASET-A-212',
      label: '主比赛数据集 A · 212 件约束货物',
      dataClassification: 'DEMO_DATA',
      container: { ...CONTAINERS['40HQ'] },
      cargoList: datasetA
    },
    {
      id: 'DATASET-B-MIXED-69',
      label: '比赛数据集 B · 69 件复杂混装',
      dataClassification: 'DEMO_DATA',
      container: { ...CONTAINERS['40HQ'] },
      cargoList: datasetB
    }
  ];
}

module.exports = { buildProjectBenchmarkCases };
