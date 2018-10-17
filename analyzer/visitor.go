package analyzer

import (
	"go/ast"
	"go/token"

	"github.com/rodrigo-brito/gocity/utils"
)

type NodeInfo struct {
	File             string
	ObjectName       string
	NumberLines      int
	NumberMethods    int
	NumberAttributes int
}

type Visitor struct {
	FileSet     *token.FileSet
	StructInfo  map[string]*NodeInfo
	PackageName string
	Path        string
}

func (v Visitor) getNumberOfLines(start, end token.Pos) int {
	return v.FileSet.Position(end).Line - v.FileSet.Position(start).Line + 1
}

func (v *Visitor) Visit(n ast.Node) ast.Visitor {
	if n == nil {
		return nil
	}

	switch d := n.(type) {
	case *ast.ValueSpec:
		identifier := utils.GetIdentifier(v.Path, v.PackageName, "")

		if _, ok := v.StructInfo[identifier]; !ok {
			v.StructInfo[identifier] = new(NodeInfo)
		}

		v.StructInfo[identifier].NumberAttributes++

	case *ast.TypeSpec:
		if structObj, ok := d.Type.(*ast.StructType); ok {
			identifier := utils.GetIdentifier(v.Path, v.PackageName, d.Name.Name)

			if _, ok := v.StructInfo[identifier]; !ok {
				v.StructInfo[identifier] = new(NodeInfo)
			}

			v.StructInfo[identifier].ObjectName = d.Name.Name
			v.StructInfo[identifier].NumberAttributes = len(structObj.Fields.List)
			v.StructInfo[identifier].NumberLines += v.getNumberOfLines(structObj.Pos(), structObj.End())
		}
	case *ast.FuncDecl:
		var structName = ""
		if d.Recv != nil && len(d.Recv.List) > 0 {
			typeObj := d.Recv.List[0].Type
			if ident, ok := typeObj.(*ast.Ident); ok {
				structName = ident.Name
			} else {
				structName = typeObj.(*ast.StarExpr).X.(*ast.Ident).Name
			}
		}

		identifier := utils.GetIdentifier(v.Path, v.PackageName, structName)

		if _, ok := v.StructInfo[identifier]; !ok {
			v.StructInfo[identifier] = new(NodeInfo)
			v.StructInfo[identifier].ObjectName = structName
		}

		v.StructInfo[identifier].NumberMethods++
		if d.Body != nil {
			v.StructInfo[identifier].NumberLines += v.getNumberOfLines(d.Body.Pos(), d.Body.End())
		}
	}

	return v
}
