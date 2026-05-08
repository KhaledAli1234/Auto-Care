import {
  CreateOptions,
  DeleteResult,
  FlattenMaps,
  HydratedDocument,
  Model,
  MongooseUpdateQueryOptions,
  PopulateOptions,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery,
  UpdateWriteOpResult,
} from 'mongoose';

import type { Filter } from 'mongodb';

export type Lean<T> = FlattenMaps<T>;
export abstract class DatabaseRepository<
  TRawDocument,
  TDocument = HydratedDocument<TRawDocument>,
> {
  constructor(protected readonly model: Model<TDocument>) {}

  async findOne({
    filter,
    select,
    options,
  }: {
    filter?: Filter<TRawDocument>;
    select?: ProjectionType<TRawDocument> | null;
    options?: QueryOptions<TDocument> | null;
  }): Promise<Lean<TDocument> | TDocument | null> {
    const doc = this.model.findOne(filter).select(select || '');
    if (options?.lean) {
      doc.lean(options.lean);
    }
    if (options?.populate) {
      doc.populate(options.populate as PopulateOptions[]);
    }
    return await doc.exec();
  }

  async findById({
    id,
    select,
    options,
  }: {
    id: Types.ObjectId;
    select?: ProjectionType<TDocument> | null;
    options?: QueryOptions<TDocument> | null;
  }): Promise<Lean<TDocument> | TDocument | null> {
    const doc = this.model.findById(id).select(select || '');
    if (options?.lean) {
      doc.lean(options.lean);
    }
    if (options?.populate) {
      doc.populate(options.populate as PopulateOptions[]);
    }
    return await doc.exec();
  }

  async create({
    data,
    options,
  }: {
    data: Partial<TRawDocument>[];
    options?: CreateOptions | undefined;
  }): Promise<TDocument[]> {
    return (await this.model.create(data as any, options)) || [];
  }

  async updateOne({
    filter,
    update,
    options,
  }: {
    filter: Filter<TRawDocument>;
    update: UpdateQuery<TDocument>;
    options?: MongooseUpdateQueryOptions<TDocument> | null;
  }): Promise<UpdateWriteOpResult> {
    if (Array.isArray(update)) {
      update.push({
        $set: {
          __v: { $add: ['$__v', 1] },
        },
      });
      return await this.model.updateOne(filter || {}, update, options);
    }
    return await this.model.updateOne(
      filter,
      { $inc: { __v: 1 }, ...update },
      options,
    );
  }

  async find({
    filter,
    select,
    options,
    populate,
  }: {
    filter?: Filter<TRawDocument>;
    select?: ProjectionType<TRawDocument>;
    options?: QueryOptions<TDocument>;
    populate?: any;
  }): Promise<TDocument[] | Lean<TDocument>[]> {
    const doc = this.model.find(filter || {});

    if (select) doc.select(select);

    if (populate) doc.populate(populate);

    if (options?.sort) doc.sort(options.sort);
    if (options?.skip) doc.skip(options.skip);
    if (options?.limit) doc.limit(options.limit);
    // if (options?.lean) doc.lean();

    return doc.exec();
  }

  async paginate({
    filter = {},
    select,
    options = {},
    page = 1,
    size = 5,
    populate,
  }: {
    filter: Filter<TRawDocument>;
    select?: ProjectionType<TRawDocument>;
    options?: QueryOptions<TDocument>;
    page?: number | 'all';
    size?: number;
    populate?: any;
  }) {
    let docCount: number | undefined;
    let pages: number | undefined;

    if (page !== 'all') {
      page = Math.max(1, Number(page) || 1);
      options.limit = Math.max(1, Number(size) || 5);
      options.skip = (page - 1) * options.limit;

      docCount = await this.model.countDocuments(filter);
      pages = Math.ceil(docCount / options.limit);
    }

    const result = await this.find({
      filter,
      select,
      options,
      populate,
    });

    return {
      docCount,
      limit: options.limit,
      pages,
      currentPage: page !== 'all' ? page : undefined,
      result,
    };
  }

  async deleteOne({
    filter,
  }: {
    filter: Filter<TRawDocument>;
  }): Promise<DeleteResult> {
    return this.model.deleteOne(filter);
  }

  async findOneAndDelete({
    filter,
  }: {
    filter: Filter<TRawDocument>;
  }): Promise<TDocument | null> {
    return await this.model.findOneAndDelete(filter);
  }

  async deleteMany({
    filter,
  }: {
    filter: Filter<TRawDocument>;
  }): Promise<DeleteResult> {
    return this.model.deleteMany(filter);
  }

  async insertMany({
    data,
  }: {
    data: Partial<TRawDocument>[];
  }): Promise<TDocument[]> {
    return (await this.model.insertMany(data)) as TDocument[];
  }

  async findByIdAndUpdate({
    id,
    update,
    options = { new: true },
  }: {
    id: Types.ObjectId;
    update?: UpdateQuery<TDocument>;
    options?: QueryOptions<TDocument> | null;
  }): Promise<TDocument | Lean<TDocument> | null> {
    return this.model.findByIdAndUpdate(
      id,
      { ...update, $inc: { __v: 1 } },
      options,
    );
  }

  async findOneAndUpdate({
    filter,
    update,
    options = { new: true },
  }: {
    filter: Filter<TRawDocument>;
    update: UpdateQuery<TDocument>;
    options?: QueryOptions<TDocument> | null;
  }): Promise<TDocument | Lean<TDocument> | null> {
    if (Array.isArray(update)) {
      update.push({
        $set: {
          __v: { $add: ['$__v', 1] },
        },
      });
      return await this.model.findOneAndUpdate(filter || {}, update, options);
    }
    return this.model.findOneAndUpdate(
      filter,
      { ...update, $inc: { __v: 1 } },
      options,
    );
  }

  async count({
    filter = {},
  }: {
    filter?: Filter<TRawDocument>;
  }): Promise<number> {
    return this.model.countDocuments(filter);
  }

  async findWithDeepPopulate({
    filter,
    page = 1,
    size = 10,
  }: {
    filter: any;
    page?: number;
    size?: number;
  }) {
    const skip = (page - 1) * size;

    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName username vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'brand model year',
        },
      })
      .populate({
        path: 'comments',
        populate: [
          {
            path: 'createdBy',
            select: 'firstName lastName username',
          },
          {
            path: 'tags',
            select: 'firstName lastName username',
          },
          {
            path: 'replies',
            populate: [
              {
                path: 'createdBy',
                select: 'firstName lastName username',
              },
              {
                path: 'tags',
                select: 'firstName lastName username',
              },
            ],
          },
        ],
      })
      .exec();
  }

  async updateMany({
    filter,
    update,
    options,
  }: {
    filter: Filter<TRawDocument>;
    update: UpdateQuery<TDocument>;
    options?: MongooseUpdateQueryOptions<TDocument> | null;
  }): Promise<UpdateWriteOpResult> {
    if (Array.isArray(update)) {
      update.push({
        $set: {
          __v: { $add: ['$__v', 1] },
        },
      });

      return await this.model.updateMany(filter || {}, update, options);
    }

    return await this.model.updateMany(
      filter,
      { $inc: { __v: 1 }, ...update },
      options,
    );
  }
}
