package opendata

import (
	"errors"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	ncccModel "faryne.dev/model/entity/opendata/nccc"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/nccc"
	"faryne.dev/service/output"
)

func NCCCIndexes(ctx fiber.Ctx) error {
	return output.Success(nccc.ListIndexes())
}

func NCCCRecords(ctx fiber.Ctx) error {
	dataSetKey, indexInfo, ok := nccc.ResolveIndexToken(ctx.Params("token"))
	if !ok {
		return output.BadRequest(errors.New("invalid nccc index token"))
	}

	var req ncccModel.RecordSearchRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}

	raw, rows, err := nccc.SearchRecords(req, dataSetKey)
	if err != nil {
		return output.ESError(err)
	}

	perPage := nccc.EffectiveRecordPerPage(req)
	currentOffset := (req.PageValue() - 1) * perPage
	if currentOffset < 0 {
		currentOffset = 0
	}
	if cursor, err := serviceHelper.DecodeESCursor(req.Cursor); err != nil {
		return output.BadRequest(err)
	} else if cursor != nil {
		currentOffset = cursor.Offset
	}
	var nextSearchAfter []any
	if len(raw.Hits.Hits) > 0 {
		nextSearchAfter = raw.Hits.Hits[len(raw.Hits.Hits)-1].Sort
	}
	pagination, err := serviceHelper.PaginateByES(ctx, serviceHelper.ESPaginateInput[[]map[string]any]{
		Data:            rows,
		Total:           raw.Hits.Total.Value,
		PerPage:         perPage,
		CurrentCursor:   req.Cursor,
		CurrentOffset:   currentOffset,
		NextSearchAfter: nextSearchAfter,
		RowsCount:       int64(len(rows)),
	})
	if err != nil {
		return output.ESError(err)
	}

	return output.Success(ncccModel.RecordSearchOutput{
		CommonESPaginationOutput: pagination,
		Index:                    indexInfo,
	})
}
