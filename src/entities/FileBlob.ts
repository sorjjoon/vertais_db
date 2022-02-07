import "reflect-metadata";

import { FileDetails } from "./FileDetails";
import { Column, Entity, JoinColumn, OneToOne, BaseEntity } from "typeorm";

@Entity()
export class FileBlob extends BaseEntity {
  @OneToOne(() => FileDetails, { nullable: false, primary: true, cascade: true, onDelete: "CASCADE" })
  @JoinColumn()
  details: FileDetails;

  @Column({ nullable: false, type: "bytea" })
  data: Buffer;
}
