import * as db from './index.js';

export async function _create(Model, payload) {
    await db.connect();
    return await Model.create({
        ...payload,
        createdAt: payload.createdAt || new Date(),
        updatedAt: payload.updatedAt || new Date()
    });
}

export async function _createMany(Model, payloads = []) {
    await db.connect();
    const dataWithTimestamps = payloads.map(item => ({
        ...item,
        createdAt: item.createdAt || new Date(),
        updatedAt: item.updatedAt || new Date()
    }));
    return await Model.insertMany(dataWithTimestamps);
}

export async function _read(Model, filter = {}, options = {}) {
    await db.connect();
    let query = Model.findOne(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.select) query = query.select(options.select);
    return await query.lean();
}

export async function _readMany(Model, filter = {}, options = {}) {
    await db.connect();
    let query = Model.find(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);
    return await query.lean();
}

export async function _update(Model, filter = {}, updateData = {}, options = { new: true }) {
    await db.connect();
    return await Model.findOneAndUpdate(
        filter,
        { ...updateData, updatedAt: new Date() },
        options
    ).lean();
}

export async function _updateMany(Model, filter = {}, updateData = {}) {
    await db.connect();
    return await Model.updateMany(
        filter,
        { ...updateData, updatedAt: new Date() }
    );
}

export async function _delete(Model, filter = {}) {
    await db.connect();
    const result = await Model.deleteOne(filter);
    return result.deletedCount > 0;
}

export async function _deleteMany(Model, filter = {}) {
    await db.connect();
    const result = await Model.deleteMany(filter);
    return result.deletedCount;
}

export async function _upsert(Model, filter = {}, updateData = {}) {
    await db.connect();
    return await Model.findOneAndUpdate(
        filter,
        {
            $set: { ...updateData, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() }
        },
        { new: true, upsert: true }
    ).lean();
}
