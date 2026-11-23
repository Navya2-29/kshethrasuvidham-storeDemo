require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const supplierRoutes = require('./routes/supplier.routes');
const departmentRoutes = require('./routes/department.routes');
const productRoutes = require('./routes/product.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const stockTransferRoutes= require('./routes/stocktransfer.routes');
const salesRoutes=require('./routes/sales.routes');
const categoryRoutes = require('./routes/category.route');
const stockRoutes = require('./routes/reportAllstock.routes');
const stockTransferReportRoutes = require('./routes/stockTransferreport.routes');
const autherRputes=require('./routes/auther.routes');
const orderRoutes = require('./routes/order.routes');
const productSummeryRoutes=require('./routes/productsummery.routes')
const publisherRoutes = require('./routes/publisher.routes');
const directEntryRoutes=require('./routes/directentry.routes');
const roleRoutes =require('./routes/role.routes');
const dashboardRoutes=require('./routes/dashboard.routes')
const app = express();
const corsOptions = {
  origin: [
    'http://localhost:5000',
    'http://localhost:4200',
    'https://storedemo.kshethrasuvidham.com',
    'http://storedemo.kshethrasuvidham.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
// app.use('/api', userRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stocks',stockTransferRoutes);
app.use('/api/sales',salesRoutes );
app.use('/api/report/purchasereport', require('./routes/purchasereport.routes'));
app.use('/api/report', stockRoutes);
app.use('/api/report', stockTransferReportRoutes);
app.use('/api/opening', require('./routes/openingbalance.routes'));
app.use('/api/author', autherRputes);
app.use('/api/orders', orderRoutes);
app.use('/api/product-summary',  productSummeryRoutes);
app.use('/api/publishers', publisherRoutes);
app.use('/api/direct-entry',directEntryRoutes);
app.use('/api/users',userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/client-settings', require('./routes/settings.routes'));
app.use('/api/dashboard', dashboardRoutes);
module.exports = app;
